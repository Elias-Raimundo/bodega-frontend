import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { PreparedProductsService } from '../../prepared-products.service';
import { ProductsService } from '../../products.service';

const API_URL = 'https://bodega-backend-9c4f.onrender.com';
// TODO: mover a environment.ts, mismo comentario que en sales.ts

@Component({
  selector: 'app-tables',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tables.html',
  styleUrl: './tables.css'
})
export class Tables implements OnInit {

  tables: any[] = [];
  products: any[] = [];
  preparedProducts: any[] = [];

  tableCount = 5;

  selectedTable: any = null;
  selectedOrder: any = null;

  search = '';

  discount = 0;
  customers: any[] = [];
  selectedCustomerId: number | null = null;
  partialPaymentAmount: number | null = null;
  partialPaymentMethod = 'CASH';
  partialPaymentCustomerId: number | null = null;

  payments = [
    {
      method: 'CASH',
      amount: 0
    }
  ];

  // NUEVO: flags de carga para evitar doble clic en acciones críticas
  closingTable = false;
  deletingTableId: number | null = null;
  registeringPartialPayment = false;
  creatingTables = false;

  constructor(
    private http: HttpClient,
    private cdRef: ChangeDetectorRef,
    private toastr: ToastrService,
    private productsService: ProductsService,
    private preparedProductsService: PreparedProductsService
  ) {}

  ngOnInit() {
    this.loadTables();
    this.loadProducts();
    this.loadPreparedProducts();
    this.loadCustomers();
  }

  getToken() {
    return localStorage.getItem('token');
  }

  getHeaders() {
    return { Authorization: `Bearer ${this.getToken()}` };
  }

  // Mismo helper que en sales.ts: mensaje legible desde cualquier error HTTP
  private getErrorMessage(err: HttpErrorResponse, fallback: string): string {
    if (err.status === 0) {
      return 'No se pudo conectar con el servidor. Revisá tu conexión a internet.';
    }
    if (typeof err.error === 'string' && err.error.trim()) {
      return err.error;
    }
    if (err.error?.message) {
      return Array.isArray(err.error.message)
        ? err.error.message.join(', ')
        : err.error.message;
    }
    if (err.status === 401) {
      return 'Tu sesión expiró. Iniciá sesión de nuevo.';
    }
    return fallback;
  }

  loadTables() {
    this.http.get<any[]>(`${API_URL}/tables`, {
      headers: this.getHeaders()
    }).subscribe({
      next: (res) => {
        this.tables = res;
        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error('Error cargando mesas:', err);
        this.toastr.error(this.getErrorMessage(err, 'No se pudieron cargar las mesas'));
      }
    });
  }

  loadProducts() {
    this.productsService.getProducts().subscribe({
      next: (res) => {
        this.products = res;
        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error('Error cargando productos:', err);
        this.toastr.error(this.getErrorMessage(err, 'No se pudieron cargar los productos'));
      }
    });
  }

  loadPreparedProducts() {
    this.preparedProductsService.getPreparedProducts().subscribe({
      next: (res) => {
        this.preparedProducts = res;
        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error('Error cargando preparados:', err);
        this.toastr.error(this.getErrorMessage(err, 'No se pudieron cargar los preparados'));
      }
    });
  }

  initTables() {
    if (this.creatingTables) return;

    if (!this.tableCount || this.tableCount <= 0) {
      this.toastr.warning('Ingresá una cantidad de mesas válida');
      return;
    }

    this.creatingTables = true;

    this.http.post<any[]>(
      `${API_URL}/tables/init?count=${this.tableCount}`,
      {},
      { headers: this.getHeaders() }
    ).subscribe({
      next: () => {
        this.creatingTables = false;
        this.toastr.success('Mesas creadas correctamente');
        this.loadTables();
      },
      error: (err) => {
        console.error('Error creando mesas:', err);
        this.creatingTables = false;
        this.toastr.error(this.getErrorMessage(err, 'Error creando mesas'));
      }
    });
  }

  openTable(table: any) {
    this.selectedTable = table;

    this.http.get<any>(
      `${API_URL}/tables/${table.id}/order`,
      { headers: this.getHeaders() }
    ).subscribe({
      next: (res) => {
        this.selectedOrder = res;
        this.loadTables();
        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error('Error abriendo mesa:', err);
        this.toastr.error(this.getErrorMessage(err, 'No se pudo abrir la mesa'));
        // Si falló la apertura, no dejamos el modal "colgado" con una mesa
        // seleccionada pero sin pedido cargado.
        this.selectedTable = null;
      }
    });
  }

  refreshCurrentOrder() {
    if (!this.selectedTable) return;

    this.http.get<any>(
      `${API_URL}/tables/${this.selectedTable.id}/order`,
      { headers: this.getHeaders() }
    ).subscribe({
      next: (res) => {
        this.selectedOrder = res;
        this.loadTables();
        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error('Error refrescando pedido:', err);
        this.toastr.error(this.getErrorMessage(err, 'No se pudo actualizar el pedido'));
      }
    });
  }

  addProductToTable(product: any) {
    this.addItemToTable({
      itemType: 'PRODUCT',
      productId: product.id,
      preparedProductId: null,
      quantity: 1
    });
  }

  addPreparedToTable(prepared: any) {
    this.addItemToTable({
      itemType: 'PREPARED',
      productId: null,
      preparedProductId: prepared.id,
      quantity: 1
    });
  }

  addItemToTable(item: any) {
    if (!this.selectedTable) return;

    this.http.post<any>(
      `${API_URL}/tables/${this.selectedTable.id}/items`,
      item,
      { headers: this.getHeaders() }
    ).subscribe({
      next: () => {
        this.refreshCurrentOrder();
        this.loadTables();
        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error('Error agregando item:', err);
        this.toastr.error(this.getErrorMessage(err, 'No se pudo agregar el producto'));
      }
    });
  }

  increaseItem(item: any) {

    if (item.itemType === 'PRODUCT') {
      const product = this.products.find(
        p => p.id === item.productId
      );

      if (product && item.quantity >= product.stock) {
        this.toastr.warning('No hay más stock disponible');
        return;
      }
    }

    if (item.itemType === 'PREPARED') {
      const prepared = this.preparedProducts.find(
        p => p.id === item.preparedProductId
      );

      if (!prepared || !prepared.ingredients || prepared.ingredients.length === 0) {
        this.toastr.warning('Este preparado no tiene ingredientes');
        return;
      }

      const newQuantity = item.quantity + 1;

      for (const ingredient of prepared.ingredients) {
        const product = ingredient.product;

        if (!product) {
          this.toastr.warning('Ingrediente inválido');
          return;
        }

        const stockNeeded = ingredient.quantity * newQuantity;

        if (product.stock < stockNeeded) {
          this.toastr.warning(`No hay más stock disponible de ${product.name}`);
          return;
        }
      }
    }

    this.updateItemQuantity(
      item,
      item.quantity + 1
    );
  }

  decreaseItem(item: any) {
    this.updateItemQuantity(
      item,
      item.quantity - 1
    );
  }

  updateItemQuantity(item: any, quantity: number) {
    this.http.put<any>(
      `${API_URL}/tables/items/${item.id}/quantity?quantity=${quantity}`,
      {},
      { headers: this.getHeaders() }
    ).subscribe({
      next: (res) => {
        this.selectedOrder = {
          ...res,
          items: [...(res.items || [])]
        };
        this.loadTables();
        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error('Error actualizando cantidad:', err);
        this.toastr.error(this.getErrorMessage(err, 'No se pudo actualizar la cantidad'));
      }
    });
  }

  removeItem(itemId: number) {
    this.http.delete(
      `${API_URL}/tables/items/${itemId}`,
      { headers: this.getHeaders() }
    ).subscribe({
      next: () => {
        if (this.selectedTable) {
          this.refreshCurrentOrder();
        }
        this.loadTables();
        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error('Error eliminando item:', err);
        this.toastr.error(this.getErrorMessage(err, 'No se pudo eliminar el producto'));
      }
    });
  }

  getAlreadyPaid() {
    if (!this.selectedOrder?.partialPayments) return 0;
    return this.selectedOrder.partialPayments.reduce(
      (acc: number, p: any) => acc + Number(p.amount),
      0
    );
  }

  getRemainingBalance() {
    return Math.max(
      this.getTotalWithDiscount() - this.getAlreadyPaid(),
      0
    );
  }

  registerPartialPayment() {
    if (!this.selectedTable) return;

    if (!this.partialPaymentAmount || this.partialPaymentAmount <= 0) {
      this.toastr.warning('Ingrese un monto válido');
      return;
    }

    if (this.partialPaymentAmount > this.getRemainingBalance() + 0.01) {
      this.toastr.warning('El monto supera el saldo pendiente');
      return;
    }

    if (this.partialPaymentMethod === 'CURRENT_ACCOUNT' && !this.partialPaymentCustomerId) {
      this.toastr.warning('Seleccioná un cliente para cuenta corriente');
      return;
    }

    if (this.registeringPartialPayment) return;
    this.registeringPartialPayment = true;

    this.http.post<any>(
      `${API_URL}/tables/${this.selectedTable.id}/partial-payment`,
      {
        amount: this.partialPaymentAmount,
        method: this.partialPaymentMethod,
        customerId: this.partialPaymentMethod === 'CURRENT_ACCOUNT'
          ? this.partialPaymentCustomerId
          : null
      },
      { headers: this.getHeaders() }
    ).subscribe({
      next: (res) => {
        this.registeringPartialPayment = false;
        this.selectedOrder = res;
        this.partialPaymentAmount = null;
        this.partialPaymentMethod = 'CASH';
        this.partialPaymentCustomerId = null;
        this.toastr.success('Pago registrado');
        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error('Error registrando pago parcial:', err);
        this.registeringPartialPayment = false;
        this.toastr.error(this.getErrorMessage(err, 'Error registrando el pago parcial'));
      }
    });
  }

  deleteTable(tableId: number, event: Event) {
    event.stopPropagation();

    if (!confirm('¿Eliminar esta mesa?')) return;

    if (this.deletingTableId === tableId) return;
    this.deletingTableId = tableId;

    this.http.delete(
      `${API_URL}/tables/${tableId}`,
      { headers: this.getHeaders() }
    ).subscribe({
      next: () => {
        this.deletingTableId = null;
        this.toastr.success('Mesa eliminada');
        this.loadTables();
        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error('Error eliminando mesa:', err);
        this.deletingTableId = null;
        this.toastr.error(this.getErrorMessage(err, 'No se pudo eliminar la mesa'));
      }
    });
  }

  updateTableName() {
    if (!this.selectedTable) return;

    this.http.put<any>(
      `${API_URL}/tables/${this.selectedTable.id}`,
      { name: this.selectedTable.name },
      { headers: this.getHeaders() }
    ).subscribe({
      next: (res) => {
        this.selectedTable = res;
        this.loadTables();
        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error('Error actualizando nombre:', err);
        this.toastr.error(this.getErrorMessage(err, 'No se pudo actualizar el nombre'));
      }
    });
  }

  addPayment() {
    this.payments.push({
      method: 'TRANSFER',
      amount: 0
    });

    this.cdRef.detectChanges();
  }

  removePayment(index: number) {
    if (this.payments.length === 1) return;

    this.payments.splice(index, 1);

    this.cdRef.detectChanges();
  }

  getPaymentsTotal() {
    return this.payments.reduce(
      (acc, p) => acc + Number(p.amount),
      0
    );
  }

  paymentsMatch() {
    return Math.abs(
      this.getPaymentsTotal() - this.getRemainingBalance()
    ) <= 0.01;
  }

  closeTable() {
    if (!this.selectedTable) return;

    if (!this.selectedOrder?.items?.length) {
      this.toastr.warning('La mesa no tiene productos cargados');
      return;
    }

    if (this.hasCurrentAccount() && !this.selectedCustomerId) {
      this.toastr.warning('Seleccioná un cliente para cuenta corriente');
      return;
    }

    if (!this.paymentsMatch()) {
      const diferencia = (
        this.getRemainingBalance() - this.getPaymentsTotal()
      ).toFixed(2);
      this.toastr.warning(
        `Los pagos no coinciden con el saldo pendiente (diferencia: $${diferencia})`
      );
      return;
    }

    if (this.closingTable) return;
    this.closingTable = true;

    this.http.post(
      `${API_URL}/tables/${this.selectedTable.id}/close`,
      {
        payments: this.payments,
        discount: Number(this.discount) || 0,
        customerId: this.selectedCustomerId || null
      },
      { headers: this.getHeaders() }
    ).subscribe({
      next: () => {
        this.closingTable = false;
        this.toastr.success('Mesa cerrada correctamente');

        this.selectedTable = null;
        this.selectedOrder = null;
        this.search = '';
        this.discount = 0;
        this.selectedCustomerId = null;
        this.partialPaymentAmount = null;
        this.partialPaymentMethod = 'CASH';
        this.partialPaymentCustomerId = null;
        this.payments = [
          {
            method: 'CASH',
            amount: 0
          }
        ];
        this.productsService.invalidateCache();
        this.loadTables();
        this.loadProducts();
        this.loadPreparedProducts();

        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error('Error cerrando mesa:', err);
        this.closingTable = false;
        this.toastr.error(this.getErrorMessage(err, 'Error cerrando la mesa'));
        this.cdRef.detectChanges();
      }
    });
  }

  loadCustomers() {
    this.http.get<any[]>(`${API_URL}/customers`, {
      headers: this.getHeaders()
    }).subscribe({
      next: (res) => {
        this.customers = res;
        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error('Error cargando clientes:', err);
        this.toastr.error(this.getErrorMessage(err, 'No se pudieron cargar los clientes'));
      }
    });
  }

  hasCurrentAccount() {
    return this.payments.some(p => p.method === 'CURRENT_ACCOUNT');
  }

  closeModal() {
    this.selectedTable = null;
    this.selectedOrder = null;
    this.search = '';
    this.discount = 0;
    this.selectedCustomerId = null;
    this.partialPaymentAmount = null;
    this.partialPaymentMethod = 'CASH';
    this.partialPaymentCustomerId = null;

    this.payments = [
      {
        method: 'CASH',
        amount: 0
      }
    ];

    this.loadTables();

    this.cdRef.detectChanges();
  }

  get filteredProducts() {
    return this.products.filter(p =>
      p.name.toLowerCase()
        .includes(this.search.toLowerCase())
    );
  }

  get filteredPreparedProducts() {
    return this.preparedProducts.filter(p =>
      p.name.toLowerCase()
        .includes(this.search.toLowerCase())
    );
  }

  getOrderTotal() {
    if (!this.selectedOrder?.items) {
      return 0;
    }

    return this.selectedOrder.items.reduce(
      (acc: number, item: any) =>
        acc + item.price * item.quantity,
      0
    );
  }

  getTotalWithDiscount() {
    const discount = Number(this.discount) || 0;
    return Math.max(
      this.getOrderTotal() - discount,
      0
    );
  }

}