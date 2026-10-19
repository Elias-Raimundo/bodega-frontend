import { Injectable, Injector, inject } from '@angular/core';
import {
  HttpClient,
  HttpContext,
  HttpContextToken,
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpRequest,
  HttpResponse
} from '@angular/common/http';
import { BehaviorSubject, Observable, TimeoutError, firstValueFrom, of, throwError } from 'rxjs';
import { catchError, tap, timeout } from 'rxjs/operators';
import { ToastrService } from 'ngx-toastr';

/*
 * MODO SIN CONEXIÓN
 * -----------------
 * - Con internet: todo va al servidor como siempre, y de paso se guarda en
 *   esta computadora una copia de mesas abiertas, productos, tragos y clientes.
 * - Sin internet: las ventas y las mesas se resuelven acá, contra esa copia,
 *   y cada acción queda en una cola de pendientes.
 * - Cuando vuelve internet: la cola se envía al servidor en el mismo orden,
 *   con la hora real de cada acción. Cada acción lleva una clave única, así el
 *   servidor no la duplica si ya la había recibido justo antes del corte.
 *
 * Pensado para usar el sistema desde UNA sola computadora.
 */

export const API_URL = 'https://bodega-backend-9c4f.onrender.com';

// Pedidos internos de este servicio: no pasan por la lógica offline.
export const SKIP_OFFLINE = new HttpContextToken<boolean>(() => false);

const REQUEST_TIMEOUT = 30000;
const PING_INTERVAL = 15000;
const SNAPSHOT_INTERVAL = 60000;
const CATALOG_INTERVAL = 5 * 60000;
const MAX_CACHE_ENTRY = 400_000; // caracteres

export interface OfflineStatus {
  online: boolean;
  pending: number;
  syncing: boolean;
  error: string | null;
  errorLabel: string | null;
}

interface QueuedOp {
  key: string;           // clave anti-duplicados (X-Idempotency-Key)
  kind: string;
  method: string;
  path: string;          // puede tener ids temporales (negativos) de ítems
  body: any;
  createdAt: string;     // hora real de la acción (hora local)
  label: string;         // descripción para mostrar si falla
  refs?: any;            // datos para vincular ids temporales con los reales
}

@Injectable({ providedIn: 'root' })
export class OfflineService {

  private injector = inject(Injector);
  private online = typeof navigator === 'undefined' ? true : navigator.onLine;
  private syncing = false;
  private syncError: { message: string; label: string } | null = null;
  private pingTimer: any = null;
  private retryTimer: any = null;
  private started = false;
  private lastSnapshot = 0;
  private lastCatalog = 0;
  private stateVersion = 0;
  private tempCounter = 0;

  readonly status$ = new BehaviorSubject<OfflineStatus>(this.buildStatus());

  // HttpClient y Toastr se piden recién cuando se usan, para no generar
  // dependencias circulares con el interceptor.
  private get http(): HttpClient {
    return this.injector.get(HttpClient);
  }

  private get toastr(): ToastrService {
    return this.injector.get(ToastrService);
  }

  // ───────────────────────── Arranque y conexión ─────────────────────────

  start() {
    if (this.started) return;
    this.started = true;

    window.addEventListener('online', () => this.checkConnection());
    window.addEventListener('offline', () => this.markOffline());

    if (!this.online) {
      this.markOffline();
    }

    // Copia de seguridad periódica de mesas y catálogo mientras hay internet
    setInterval(() => this.backgroundRefresh(), 15000);
    setTimeout(() => this.backgroundRefresh(), 2000);

    this.emit();

    if (this.online && this.readQueue().length) {
      this.sync();
    }
  }

  isOnline() {
    return this.online;
  }

  hasSession(): boolean {
    return this.companyId() !== null;
  }

  pendingCount(): number {
    return this.readQueue().length;
  }

  markOffline() {
    const wasOnline = this.online;
    this.online = false;
    this.emit();

    if (wasOnline) {
      this.toastr.warning(
        'Se cortó internet. Podés seguir vendiendo: todo se guarda en esta computadora.',
        'Sin conexión',
        { timeOut: 6000 }
      );
    }

    if (!this.pingTimer) {
      this.pingTimer = setInterval(() => this.checkConnection(), PING_INTERVAL);
    }
  }

  private setOnline() {
    const wasOffline = !this.online;
    this.online = true;

    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }

    this.emit();

    if (wasOffline) {
      const pending = this.readQueue().length;
      this.toastr.success(
        pending
          ? `Volvió internet. Sincronizando ${pending} ${pending === 1 ? 'operación' : 'operaciones'}…`
          : 'Volvió internet.',
        'Conectado'
      );
    }

    this.sync();
  }

  // Prueba si el servidor responde (endpoint público, sin sesión)
  checkConnection() {
    this.http.get(`${API_URL}/auth/test`, {
      responseType: 'text',
      context: new HttpContext().set(SKIP_OFFLINE, true)
    }).pipe(timeout(10000)).subscribe({
      next: () => this.setOnline(),
      error: (err) => {
        // Cualquier respuesta del servidor (aunque sea error) significa que hay conexión
        if (err?.status > 0) {
          this.setOnline();
        } else if (this.online) {
          this.markOffline();
        }
      }
    });
  }

  // ───────────────────────── Entrada desde el interceptor ─────────────────────────

  handle(req: HttpRequest<any>, next: HttpHandlerFn): Observable<HttpEvent<any>> {
    const path = req.urlWithParams.substring(API_URL.length);
    const pathOnly = path.split('?')[0];
    const isGet = req.method === 'GET';
    const local = this.isLocalRoute(req.method, pathOnly);

    // Sin internet, o con operaciones todavía sin enviar: mesas y ventas se
    // resuelven acá para respetar el orden de las acciones.
    if (!this.online || this.readQueue().length > 0 || this.syncing) {

      if (local) {
        return this.handleLocal(req.method, path, req.body, null);
      }

      if (isGet) {
        return this.online
          ? this.networkGet(req, path, next)
          : this.fromCache(path);
      }

      if (!this.online) {
        return this.fail('Sin conexión: esta acción no está disponible hasta que vuelva internet.', 503);
      }

      if (/^\/(daily-cash\/close|cash-closures)/.test(pathOnly)) {
        return this.fail(
          'Hay ventas sin sincronizar. Esperá a que se envíen antes de cerrar la caja.',
          409
        );
      }

      return next(req);
    }

    if (isGet) {
      return this.networkGet(req, path, next);
    }

    // Con internet y sin pendientes: va al servidor normalmente.
    // Mesas y ventas llevan una clave anti-duplicados por si la respuesta
    // no llega y hay que reenviarla después.
    let outgoing = req;
    let key: string | null = null;

    if (local) {
      key = this.newKey();
      let translated: string;
      try {
        translated = this.translatePath(path);
      } catch {
        return this.fail('Ese producto ya no está en la mesa. Volvé a abrirla.');
      }
      outgoing = req.clone({
        url: API_URL + translated,
        setHeaders: { 'X-Idempotency-Key': key }
      });
    }

    return next(outgoing).pipe(
      timeout(REQUEST_TIMEOUT),
      tap(event => {
        if (event instanceof HttpResponse) {
          this.onServerResponse(req.method, pathOnly, event.body);
        }
      }),
      catchError(err => {
        if (!this.isNetworkError(err)) {
          return throwError(() => err);
        }

        this.markOffline();

        if (local) {
          // Se guarda con la MISMA clave: si el servidor la había recibido,
          // al reenviarla no se duplica.
          return this.handleLocal(req.method, path, req.body, key);
        }

        return this.fail('Sin conexión: esta acción no está disponible hasta que vuelva internet.', 503);
      })
    );
  }

  private isLocalRoute(method: string, pathOnly: string): boolean {
    if (pathOnly === '/tables' || pathOnly.startsWith('/tables/')) return true;
    if (pathOnly === '/sales' && method === 'POST') return true;
    return false;
  }

  private isNetworkError(err: any): boolean {
    return err instanceof TimeoutError || err?.status === 0;
  }

  private networkGet(req: HttpRequest<any>, path: string, next: HttpHandlerFn): Observable<HttpEvent<any>> {
    const pathOnly = path.split('?')[0];
    const startVersion = this.stateVersion;

    return next(req).pipe(
      timeout(REQUEST_TIMEOUT),
      tap(event => {
        if (event instanceof HttpResponse) {
          this.saveCache(path, event.body);
          this.onServerGet(pathOnly, event.body, startVersion);
        }
      }),
      catchError(err => {
        if (!this.isNetworkError(err)) {
          return throwError(() => err);
        }
        this.markOffline();
        return this.fromCache(path);
      })
    );
  }

  // ───────────────────────── Actualizar la copia local con lo que responde el servidor ─────────────────────────

  private onServerGet(pathOnly: string, body: any, startVersion: number) {
    if (pathOnly === '/tables' && Array.isArray(body)) {
      this.write('tables', body);
      this.refreshSnapshot();
      return;
    }

    const orderMatch = pathOnly.match(/^\/tables\/(\d+)\/order$/);
    if (orderMatch && body && startVersion === this.stateVersion) {
      const orders = this.readOrders();
      orders[orderMatch[1]] = body;
      this.write('orders', orders);
    }
  }

  private onServerResponse(method: string, pathOnly: string, body: any) {
    this.stateVersion++;
    const orders = this.readOrders();

    const saveOrder = (order: any) => {
      if (order?.table?.id) {
        orders[order.table.id] = order;
      }
    };

    if (method === 'POST' && /^\/tables\/\d+\/(items|partial-payment)$/.test(pathOnly)) {
      saveOrder(body);
    } else if (method === 'PUT' && /^\/tables\/items\/-?\d+\/quantity$/.test(pathOnly)) {
      saveOrder(body);
    } else if (method === 'POST' && /^\/tables\/items\/-?\d+\/split$/.test(pathOnly)) {
      (Array.isArray(body) ? body : []).forEach(saveOrder);
    } else if (method === 'DELETE' && /^\/tables\/items\/-?\d+$/.test(pathOnly)) {
      const itemId = Number(pathOnly.split('/').pop());
      Object.values(orders).forEach((o: any) => {
        o.items = (o.items || []).filter((i: any) => i.id !== itemId);
      });
    } else {
      const close = pathOnly.match(/^\/tables\/(\d+)\/close$/);
      if (method === 'POST' && close) {
        delete orders[close[1]];
      }
    }

    this.write('orders', orders);
  }

  // Trae todos los pedidos abiertos para tener la copia al día
  refreshSnapshot(force = false) {
    if (!this.online || !this.hasSession()) return;
    if (this.readQueue().length || this.syncing) return;
    if (!force && Date.now() - this.lastSnapshot < 15000) return;

    this.lastSnapshot = Date.now();
    const startVersion = this.stateVersion;

    this.internalGet<any[]>('/tables/orders/open').subscribe({
      next: (list) => {
        // Si mientras tanto hubo cambios, esta foto ya es vieja: se descarta
        if (startVersion !== this.stateVersion || this.readQueue().length) return;

        const orders: Record<string, any> = {};
        (list || []).forEach(o => {
          if (o?.table?.id && !orders[o.table.id]) {
            orders[o.table.id] = o;
          }
        });
        this.write('orders', orders);
      },
      error: () => {}
    });
  }

  private backgroundRefresh() {
    if (!this.online || !this.hasSession()) return;

    // Si quedó algo pendiente (por ejemplo, se cortó la sesión a mitad de
    // la sincronización), se retoma solo.
    if (this.readQueue().length && !this.syncing && !this.syncError) {
      this.sync();
      return;
    }

    if (Date.now() - this.lastSnapshot >= SNAPSHOT_INTERVAL) {
      this.refreshSnapshot(true);
      this.cacheFromServer('/tables', body => this.write('tables', body));
    }

    if (Date.now() - this.lastCatalog >= CATALOG_INTERVAL) {
      this.lastCatalog = Date.now();
      ['/products', '/prepared-products', '/customers', '/categories']
        .forEach(p => this.cacheFromServer(p));
    }
  }

  private cacheFromServer(path: string, after?: (body: any) => void) {
    this.internalGet<any>(path).subscribe({
      next: body => {
        this.saveCache(path, body);
        after?.(body);
      },
      error: () => {}
    });
  }

  private internalGet<T>(path: string): Observable<T> {
    return this.http.get<T>(API_URL + path, {
      context: new HttpContext().set(SKIP_OFFLINE, true)
    }).pipe(timeout(REQUEST_TIMEOUT));
  }

  // ───────────────────────── Respuestas locales (sin internet) ─────────────────────────

  private handleLocal(method: string, path: string, body: any, key: string | null): Observable<HttpEvent<any>> {
    const [pathOnly, query] = path.split('?');
    const params = new URLSearchParams(query || '');
    let m: RegExpMatchArray | null;

    try {
      if (method === 'GET' && pathOnly === '/tables') {
        return this.ok(this.localTables());
      }
      if (method === 'GET' && pathOnly === '/tables/orders/open') {
        return this.ok(Object.values(this.readOrders()));
      }
      if (method === 'GET' && (m = pathOnly.match(/^\/tables\/(\d+)\/order$/))) {
        return this.ok(this.getOrCreateOrder(Number(m[1]), false));
      }
      if (method === 'POST' && (m = pathOnly.match(/^\/tables\/(\d+)\/items$/))) {
        return this.ok(this.localAddItem(Number(m[1]), body, path, key));
      }
      if (method === 'PUT' && (m = pathOnly.match(/^\/tables\/items\/(-?\d+)\/quantity$/))) {
        return this.ok(this.localUpdateQuantity(Number(m[1]), Number(params.get('quantity')), path, key));
      }
      if (method === 'DELETE' && (m = pathOnly.match(/^\/tables\/items\/(-?\d+)$/))) {
        this.localRemoveItem(Number(m[1]), path, key);
        return this.ok(null);
      }
      if (method === 'POST' && (m = pathOnly.match(/^\/tables\/items\/(-?\d+)\/split$/))) {
        return this.ok(this.localSplit(Number(m[1]), body, path, key));
      }
      if (method === 'POST' && (m = pathOnly.match(/^\/tables\/(\d+)\/partial-payment$/))) {
        return this.ok(this.localPartialPayment(Number(m[1]), body, path, key));
      }
      if (method === 'POST' && (m = pathOnly.match(/^\/tables\/(\d+)\/close$/))) {
        this.localCloseTable(Number(m[1]), body, path, key);
        return this.ok(null);
      }
      if (method === 'POST' && pathOnly === '/sales') {
        return this.ok(this.localSale(body, path, key));
      }

      return this.fail(
        'Sin conexión: esta acción no está disponible hasta que vuelva internet.',
        503
      );
    } catch (e: any) {
      return this.fail(e?.message || 'No se pudo completar la acción sin conexión');
    }
  }

  private localTables() {
    const orders = this.readOrders();
    return this.read<any[]>('tables', []).map(t => ({
      ...t,
      occupied: !!orders[t.id]?.items?.length
    }));
  }

  private findTable(tableId: number) {
    const table = this.read<any[]>('tables', []).find(t => t.id === tableId);
    if (!table) {
      throw new Error('Mesa no disponible sin conexión');
    }
    return table;
  }

  private getOrCreateOrder(tableId: number, save = true) {
    const orders = this.readOrders();

    if (!orders[tableId]) {
      const table = this.findTable(tableId);
      orders[tableId] = {
        id: this.tempId(),
        closed: false,
        items: [],
        partialPayments: [],
        table: { id: table.id, name: table.name, occupied: false }
      };
      if (save) this.write('orders', orders);
    }

    return orders[tableId];
  }

  private findItem(itemId: number) {
    const orders = this.readOrders();
    for (const key of Object.keys(orders)) {
      const item = (orders[key].items || []).find((i: any) => i.id === itemId);
      if (item) return { orders, order: orders[key], item };
    }
    throw new Error('Ese producto ya no está en la mesa. Volvé a abrirla.');
  }

  private localAddItem(tableId: number, body: any, path: string, key: string | null) {
    const itemType = body?.itemType || 'PRODUCT';
    const quantity = Number(body?.quantity) || 0;

    if (quantity <= 0) throw new Error('La cantidad debe ser mayor a cero');

    const source = itemType === 'PRODUCT'
      ? this.cachedList('/products').find(p => p.id === body.productId)
      : this.cachedList('/prepared-products').find(p => p.id === body.preparedProductId);

    if (!source) throw new Error('Producto no disponible sin conexión');

    const orders = this.readOrders();
    const order = orders[tableId] || this.getOrCreateOrder(tableId, false);
    orders[tableId] = order;

    let item = order.items.find((i: any) =>
      !i.linkedGroupId &&
      i.itemType === itemType &&
      (itemType === 'PRODUCT'
        ? i.productId === body.productId
        : i.preparedProductId === body.preparedProductId)
    );

    if (item) {
      item.quantity += quantity;
    } else {
      item = {
        id: this.tempId(),
        productName: source.name,
        quantity,
        price: Number(source.price) || 0,
        productId: itemType === 'PRODUCT' ? source.id : null,
        preparedProductId: itemType === 'PREPARED' ? source.id : null,
        itemType,
        linkedGroupId: null,
        stockOwner: null,
        stockQuantity: null,
        splitParts: null
      };
      order.items.push(item);
    }

    this.write('orders', orders);
    this.enqueue({
      kind: 'addItem', method: 'POST', path, body, key,
      label: `Agregar ${source.name} a ${order.table?.name || 'la mesa'}`,
      refs: { tableId, localItemId: item.id }
    });

    return order;
  }

  private localUpdateQuantity(itemId: number, quantity: number, path: string, key: string | null) {
    const { orders, order, item } = this.findItem(itemId);

    if (quantity <= 0) {
      order.items = order.items.filter((i: any) => i.id !== itemId);
      this.passStockOwner(orders, item);
    } else {
      if (item.linkedGroupId) {
        throw new Error('No se puede cambiar la cantidad de un ítem compartido. Quitalo y volvé a dividirlo.');
      }
      item.quantity = quantity;
    }

    this.write('orders', orders);
    this.enqueue({
      kind: 'updateQuantity', method: 'PUT', path, body: {}, key,
      label: `Cambiar cantidad de ${item.productName}`
    });

    return order;
  }

  private localRemoveItem(itemId: number, path: string, key: string | null) {
    const { orders, order, item } = this.findItem(itemId);

    order.items = order.items.filter((i: any) => i.id !== itemId);
    this.passStockOwner(orders, item);

    this.write('orders', orders);
    this.enqueue({
      kind: 'removeItem', method: 'DELETE', path, body: null, key,
      label: `Quitar ${item.productName} de ${order.table?.name || 'la mesa'}`
    });
  }

  // Igual que el backend: si se borra la parte "dueña" del stock de un
  // ítem compartido, otra parte toma su lugar.
  private passStockOwner(orders: Record<string, any>, removed: any) {
    if (!removed.linkedGroupId || removed.stockOwner === false) return;

    for (const o of Object.values(orders)) {
      const sibling = (o.items || []).find((i: any) => i.linkedGroupId === removed.linkedGroupId);
      if (sibling) {
        sibling.stockOwner = true;
        sibling.stockQuantity = this.unitsForStock(removed);
        return;
      }
    }
  }

  private localSplit(itemId: number, body: any, path: string, key: string | null) {
    const { orders, order, item } = this.findItem(itemId);
    const originTableId = order.table.id;
    const shares: any[] = body?.shares || [];

    if (item.linkedGroupId) {
      throw new Error('Este ítem ya está dividido. Quitalo y volvé a cargarlo para repartirlo de nuevo.');
    }
    if (shares.length < 2) {
      throw new Error('Debe repartir el ítem entre al menos 2 mesas');
    }
    if (!shares.some(s => s.tableId === originTableId)) {
      throw new Error('La mesa original tiene que participar del reparto');
    }
    if (shares.some(s => !s.tableId || !(Number(s.amount) > 0))) {
      throw new Error('Cada parte del reparto debe ser mayor a cero');
    }
    if (new Set(shares.map(s => s.tableId)).size !== shares.length) {
      throw new Error('No podés repetir la misma mesa en el reparto');
    }

    const totalValue = item.price * item.quantity;
    const sum = shares.reduce((acc, s) => acc + Number(s.amount), 0);
    if (Math.abs(sum - totalValue) > 0.01) {
      throw new Error('La suma de las partes no coincide con el total del ítem');
    }

    const groupId = this.newKey();
    const originalQuantity = item.quantity;
    const parts: any[] = [];
    const affected: any[] = [order];

    for (const share of shares) {
      if (share.tableId === originTableId) {
        Object.assign(item, {
          quantity: 1,
          price: Number(share.amount),
          linkedGroupId: groupId,
          stockOwner: true,
          stockQuantity: originalQuantity,
          splitParts: shares.length
        });
      } else {
        const dest = orders[share.tableId] || this.getOrCreateOrder(share.tableId, false);
        orders[share.tableId] = dest;

        const part = {
          id: this.tempId(),
          productName: item.productName,
          quantity: 1,
          price: Number(share.amount),
          productId: item.productId,
          preparedProductId: item.preparedProductId,
          itemType: item.itemType,
          linkedGroupId: groupId,
          stockOwner: false,
          stockQuantity: 0,
          splitParts: shares.length
        };

        dest.items.push(part);
        parts.push({ tableId: share.tableId, localItemId: part.id });
        affected.push(dest);
      }
    }

    this.write('orders', orders);
    this.enqueue({
      kind: 'split', method: 'POST', path, body, key,
      label: `Dividir ${item.productName} entre ${shares.length} mesas`,
      refs: { originTableId, originItemId: itemId, parts }
    });

    return affected;
  }

  private localPartialPayment(tableId: number, body: any, path: string, key: string | null) {
    const orders = this.readOrders();
    const order = orders[tableId];
    const amount = Number(body?.amount);

    if (!order || !order.items?.length) throw new Error('La mesa no tiene productos');
    if (!(amount > 0)) throw new Error('El importe debe ser mayor a cero');
    if (!body?.method) throw new Error('Debe seleccionar un método de pago');
    if (body.method === 'CURRENT_ACCOUNT' && !body.customerId) {
      throw new Error('Debe seleccionar un cliente para cuenta corriente');
    }

    const remaining = this.orderTotal(order) - this.alreadyPaid(order);
    if (amount > remaining + 0.01) {
      throw new Error(`El monto supera el saldo pendiente ($${Math.round(remaining)})`);
    }

    order.partialPayments = order.partialPayments || [];
    order.partialPayments.push({
      id: this.tempId(),
      amount,
      method: body.method,
      customerId: body.method === 'CURRENT_ACCOUNT' ? body.customerId : null,
      createdAt: this.localNow()
    });

    this.write('orders', orders);
    this.enqueue({
      kind: 'partialPayment', method: 'POST', path, body, key,
      label: `Pago parcial de $${amount} en ${order.table?.name || 'la mesa'}`
    });

    return order;
  }

  private localCloseTable(tableId: number, body: any, path: string, key: string | null) {
    const orders = this.readOrders();
    const order = orders[tableId];

    if (!order || !order.items?.length) throw new Error('La mesa no tiene productos');

    const payments: any[] = body?.payments || [];
    if (!payments.length) throw new Error('Debe registrar al menos un pago');
    if (payments.some(p => !(Number(p.amount) > 0))) {
      throw new Error('El importe del pago debe ser mayor a cero');
    }

    const subtotal = this.orderTotal(order);
    const discount = Number(body?.discount) || 0;
    const paid = this.alreadyPaid(order);

    if (discount < 0) throw new Error('El descuento no puede ser negativo');
    if (discount > subtotal - paid) throw new Error('El descuento no puede ser mayor al saldo aún no pagado');

    const remaining = subtotal - discount - paid;
    const paymentsTotal = payments.reduce((acc, p) => acc + Number(p.amount), 0);
    if (Math.abs(paymentsTotal - remaining) > 0.01) {
      throw new Error(`Los pagos no coinciden con el saldo pendiente ($${Math.round(remaining)})`);
    }
    if (payments.some(p => p.method === 'CURRENT_ACCOUNT') && !body?.customerId) {
      throw new Error('Debe seleccionar un cliente para cuenta corriente');
    }

    for (const item of order.items) {
      this.discountStock(item.itemType, item.productId, item.preparedProductId, this.unitsForStock(item));
    }

    delete orders[tableId];
    this.write('orders', orders);
    this.enqueue({
      kind: 'closeTable', method: 'POST', path, body, key,
      label: `Cerrar ${order.table?.name || 'mesa'} ($${Math.round(subtotal - discount)})`
    });
  }

  private localSale(body: any, path: string, key: string | null) {
    const items: any[] = body?.items || [];
    const payments: any[] = body?.payments || [];

    if (!items.length) throw new Error('Debe agregar al menos un producto');

    let subtotal = 0;
    for (const item of items) {
      if (!(item.quantity > 0)) throw new Error('La cantidad debe ser mayor a cero');

      const source = (item.itemType || 'PRODUCT') === 'PRODUCT'
        ? this.cachedList('/products').find(p => p.id === item.productId)
        : this.cachedList('/prepared-products').find(p => p.id === item.preparedProductId);

      if (!source) throw new Error('Producto no disponible sin conexión');
      subtotal += Number(source.price) * item.quantity;
    }

    const discount = Number(body?.discount) || 0;
    if (discount < 0) throw new Error('El descuento no puede ser negativo');
    if (discount > subtotal) throw new Error('El descuento no puede ser mayor al subtotal');

    const total = subtotal - discount;

    if (!payments.length) throw new Error('Debe registrar al menos un pago');
    if (payments.some(p => !(Number(p.amount) > 0))) {
      throw new Error('El importe del pago debe ser mayor a cero');
    }
    if (payments.some(p => p.method === 'CURRENT_ACCOUNT') && !body?.customerId) {
      throw new Error('Debe seleccionar un cliente para cuenta corriente');
    }

    const paymentsTotal = payments.reduce((acc, p) => acc + Number(p.amount), 0);
    if (Math.abs(paymentsTotal - total) > 0.01) {
      throw new Error('Los pagos no coinciden con el total');
    }

    for (const item of items) {
      this.discountStock(item.itemType || 'PRODUCT', item.productId, item.preparedProductId, item.quantity);
    }

    this.enqueue({
      kind: 'sale', method: 'POST', path, body, key,
      label: `Venta por $${Math.round(total)}`
    });

    return { id: `offline-${Date.now()}`, subtotal, discount, total, offline: true };
  }

  // Descuenta stock en la copia local, para que la pantalla muestre
  // valores razonables mientras no hay internet.
  private discountStock(itemType: string, productId: number | null, preparedId: number | null, units: number) {
    if (!units) return;

    const products = this.cachedList('/products');

    if (itemType === 'PRODUCT') {
      const p = products.find(x => x.id === productId);
      if (p) p.stock = (Number(p.stock) || 0) - units;
    } else {
      const prepared = this.cachedList('/prepared-products').find(x => x.id === preparedId);
      for (const ing of prepared?.ingredients || []) {
        const p = products.find(x => x.id === ing.product?.id);
        if (p) p.stock = (Number(p.stock) || 0) - (Number(ing.quantity) || 0) * units;
      }
    }

    this.saveCache('/products', products);
  }

  private unitsForStock(item: any): number {
    if (!item.linkedGroupId) return item.quantity;
    if (item.stockOwner === false) return 0;
    return item.stockQuantity ?? item.quantity;
  }

  private orderTotal(order: any) {
    return (order.items || []).reduce((acc: number, i: any) => acc + i.price * i.quantity, 0);
  }

  private alreadyPaid(order: any) {
    return (order.partialPayments || []).reduce((acc: number, p: any) => acc + Number(p.amount), 0);
  }

  // ───────────────────────── Cola y sincronización ─────────────────────────

  private enqueue(op: Omit<QueuedOp, 'key' | 'createdAt'> & { key: string | null }) {
    const queue = this.readQueue();
    queue.push({
      ...op,
      key: op.key || this.newKey(),
      createdAt: this.localNow()
    });
    this.write('queue', queue);
    this.stateVersion++;
    this.emit();
  }

  async sync() {
    if (this.syncing || !this.online || !this.hasSession()) return;
    if (this.syncError) return;
    if (!this.readQueue().length) return;

    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    this.syncing = true;
    this.emit();

    let sent = 0;

    try {
      while (true) {
        const queue = this.readQueue();
        if (!queue.length) break;

        const op = queue[0];

        try {
          await this.replay(op);
        } catch (err: any) {
          if (this.isNetworkError(err)) {
            this.markOffline();
          } else if (err?.status === 401) {
            // El interceptor de sesión lleva al login; al volver a entrar
            // la cola sigue guardada y se retoma sola.
          } else if (err?.status >= 500) {
            this.retryTimer = setTimeout(() => this.sync(), 30000);
          } else {
            this.syncError = {
              message: err?.error?.error || err?.message || 'Error desconocido',
              label: op.label
            };
          }
          break;
        }

        this.write('queue', this.readQueue().filter(q => q.key !== op.key));
        sent++;
        this.emit();
      }
    } finally {
      this.syncing = false;
      this.emit();
    }

    if (sent > 0 && !this.readQueue().length) {
      this.toastr.success(
        `Se sincronizaron ${sent} ${sent === 1 ? 'operación' : 'operaciones'} con el servidor.`,
        'Todo al día'
      );
      this.lastCatalog = 0;
      this.refreshSnapshot(true);
      this.cacheFromServer('/tables', body => this.write('tables', body));
      this.cacheFromServer('/products');
    }
  }

  // Reenvía una operación de la cola al servidor
  private async replay(op: QueuedOp) {
    const path = this.translatePath(op.path);

    const res: any = await firstValueFrom(
      this.http.request(op.method, API_URL + path, {
        body: op.body ?? undefined,
        headers: {
          'X-Idempotency-Key': op.key,
          'X-Offline-Created-At': op.createdAt
        },
        context: new HttpContext().set(SKIP_OFFLINE, true)
      }).pipe(timeout(REQUEST_TIMEOUT))
    );

    const duplicate = res?.duplicate === true;
    const idmap = this.read<Record<string, number>>('idmap', {});

    if (op.kind === 'addItem' && op.refs?.localItemId < 0) {
      const order = duplicate ? await this.fetchOrder(op.refs.tableId) : res;
      const body = op.body || {};
      const real = (order?.items || []).find((i: any) =>
        !i.linkedGroupId &&
        i.itemType === (body.itemType || 'PRODUCT') &&
        ((body.itemType || 'PRODUCT') === 'PRODUCT'
          ? i.productId === body.productId
          : i.preparedProductId === body.preparedProductId)
      );
      if (real) idmap[op.refs.localItemId] = real.id;
    }

    if (op.kind === 'split' && op.refs) {
      const originId = this.mapId(op.refs.originItemId, idmap);
      const tableIds: number[] = [op.refs.originTableId, ...op.refs.parts.map((p: any) => p.tableId)];

      const orders: any[] = duplicate || !Array.isArray(res)
        ? await Promise.all(tableIds.map(id => this.fetchOrder(id)))
        : res;

      const byTable = (id: number) => orders.find(o => o?.table?.id === id);
      const origin = (byTable(op.refs.originTableId)?.items || []).find((i: any) => i.id === originId);
      const groupId = origin?.linkedGroupId;

      if (groupId) {
        for (const part of op.refs.parts) {
          const real = (byTable(part.tableId)?.items || []).find((i: any) => i.linkedGroupId === groupId);
          if (real) idmap[part.localItemId] = real.id;
        }
      }
    }

    this.write('idmap', idmap);
  }

  private fetchOrder(tableId: number): Promise<any> {
    return firstValueFrom(this.internalGet<any>(`/tables/${tableId}/order`));
  }

  // Reemplaza ids temporales de ítems por los ids reales del servidor
  private translatePath(path: string): string {
    const idmap = this.read<Record<string, number>>('idmap', {});

    return path.replace(/\/tables\/items\/(-\d+)/, (match, id) => {
      const real = idmap[id];
      if (real === undefined) {
        throw Object.assign(new Error('No se encontró el producto en el servidor'), { status: 400 });
      }
      return `/tables/items/${real}`;
    });
  }

  private mapId(id: number, idmap: Record<string, number>) {
    return id < 0 ? idmap[id] : id;
  }

  // Botones del aviso de error
  retrySync() {
    this.syncError = null;
    this.emit();
    if (this.online) this.sync();
    else this.checkConnection();
  }

  discardFailed() {
    const queue = this.readQueue();
    queue.shift();
    this.write('queue', queue);
    this.syncError = null;
    this.emit();
    this.sync();
  }

  // ───────────────────────── Caché de consultas ─────────────────────────

  private fromCache(path: string): Observable<HttpEvent<any>> {
    const cached = this.read<any>('get:' + path, undefined);
    if (cached !== undefined) {
      return this.ok(cached);
    }

    // Búsquedas de productos: se filtran sobre la lista completa guardada
    const [pathOnly, query] = path.split('?');
    if (pathOnly === '/products') {
      const params = new URLSearchParams(query || '');
      const search = (params.get('search') || '').toLowerCase().trim();
      const categoryId = params.get('categoryId');
      const lowStock = params.get('lowStock') === 'true';
      const limit = Number(params.get('limit')) || 1000;

      let list = this.cachedList('/products');
      if (search) list = list.filter(p => (p.name || '').toLowerCase().includes(search));
      if (categoryId) list = list.filter(p => String(p.category?.id) === categoryId);
      if (lowStock) list = list.filter(p => p.stock < 2).sort((a, b) => a.stock - b.stock);

      return this.ok(list.slice(0, limit));
    }

    return throwError(() => new HttpErrorResponse({ status: 0, statusText: 'Sin conexión' }));
  }

  private cachedList(path: string): any[] {
    const list = this.read<any>('get:' + path, []);
    return Array.isArray(list) ? list : [];
  }

  private saveCache(path: string, body: any) {
    try {
      const json = JSON.stringify(body);
      if (json.length > MAX_CACHE_ENTRY) return;
      localStorage.setItem(this.prefix() + 'get:' + path, json);
    } catch {
      // Sin lugar o sin acceso al almacenamiento: se ignora
    }
  }

  // ───────────────────────── Almacenamiento ─────────────────────────

  // Todo se guarda separado por empresa, por si en la misma computadora
  // entra otra cuenta.
  private companyId(): string | null {
    try {
      const token = localStorage.getItem('token');
      if (!token || token === 'undefined') return null;
      const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const data = JSON.parse(atob(payload));
      return data.companyId != null ? String(data.companyId) : null;
    } catch {
      return null;
    }
  }

  private prefix() {
    return `offline:${this.companyId() ?? 'none'}:`;
  }

  private read<T>(name: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(this.prefix() + name);
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  private write(name: string, value: any) {
    try {
      localStorage.setItem(this.prefix() + name, JSON.stringify(value));
    } catch {
      // ignorado
    }
  }

  private readQueue(): QueuedOp[] {
    return this.hasSession() ? this.read<QueuedOp[]>('queue', []) : [];
  }

  private readOrders(): Record<string, any> {
    return this.read<Record<string, any>>('orders', {});
  }

  // ───────────────────────── Utilidades ─────────────────────────

  private ok(body: any): Observable<HttpEvent<any>> {
    return of(new HttpResponse({ status: 200, body: body == null ? body : structuredClone(body) }));
  }

  private fail(message: string, status = 400): Observable<never> {
    return throwError(() => new HttpErrorResponse({ status, error: { error: message } }));
  }

  private tempId(): number {
    this.tempCounter = (this.tempCounter + 1) % 1000;
    return -(Date.now() * 1000 + this.tempCounter);
  }

  private newKey(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return 'k-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  }

  // Hora local en formato 2026-10-19T21:30:00 (la que espera el backend)
  private localNow(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
      `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  private buildStatus(): OfflineStatus {
    return {
      online: this.online,
      pending: this.readQueue().length,
      syncing: this.syncing,
      error: this.syncError?.message ?? null,
      errorLabel: this.syncError?.label ?? null
    };
  }

  private emit() {
    this.status$?.next(this.buildStatus());
  }
}
