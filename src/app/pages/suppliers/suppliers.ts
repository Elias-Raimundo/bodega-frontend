import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { ProductsService } from '../../products.service';

// Renglón de una compra
interface PurchaseLine {
  productId: number | null;   // null = producto nuevo
  name: string;
  categoryId: number | null;  // solo para productos nuevos
  isNew: boolean;
  quantity: number | null;
  unitCost: number | null;
  oldCost: number;            // costo antes de la compra
  oldPrice: number | null;    // precio de venta antes de la compra
  salePrice: number | null;   // precio de venta que va a quedar
  stock: number;
}

const API_URL = 'https://bodega-backend-9c4f.onrender.com';
// TODO: mover a environment.ts, mismo comentario que en los demás componentes

@Component({
  selector: 'app-suppliers',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './suppliers.html',
  styleUrl: './suppliers.css'
})
export class Suppliers implements OnInit {

  suppliers: any[] = [];
  invoices: any[] = [];

  search = '';

  showCreateModal = false;

  selectedSupplier: any = null;

  newSupplierName = '';
  newSupplierDescription = '';

  editingSupplier: any = null;
  editSupplierName = '';
  editSupplierDescription = '';

  invoiceForm = {
    invoiceNumber: '',
    invoiceDate: '',
    totalAmount: null as number | null,
    paidAmount: null as number | null,
    description: ''
  };

  paymentAmount: {[invoiceId: number]: number | null} = {};

  // NUEVO: flags de carga para evitar doble submit
  creatingSupplier = false;
  updatingSupplier = false;
  deletingSupplierId: number | null = null;
  creatingInvoice = false;
  deletingInvoiceId: number | null = null;
  registeringPaymentInvoiceId: number | null = null;

  // Compra con productos
  showPurchase = false;
  loadingPurchaseData = false;
  savingPurchase = false;
  purchaseProducts: any[] = [];
  purchaseCategories: any[] = [];
  purchaseSearch = '';
  purchaseResults: any[] = [];
  purchaseLines: PurchaseLine[] = [];
  purchaseRoundTo = 50;
  purchaseForm = {
    invoiceNumber: '',
    invoiceDate: '',
    paidAmount: null as number | null,
    description: ''
  };

  constructor(
    private http: HttpClient,
    private cdRef: ChangeDetectorRef,
    private toastr: ToastrService,
    private productsService: ProductsService
  ) {}

  ngOnInit() {
    this.loadSuppliers();
  }

  getToken() {
    return localStorage.getItem('token');
  }

  getHeaders() {
    return {
      Authorization: `Bearer ${this.getToken()}`
    };
  }

  // Mismo helper que en el resto de los componentes
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

  loadSuppliers() {
    this.http.get<any[]>(
      `${API_URL}/suppliers`,
      { headers: this.getHeaders() }
    ).subscribe({
      next: (res) => {
        this.suppliers = res;
        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error(err);
        this.toastr.error(this.getErrorMessage(err, 'No se pudieron cargar los proveedores'));
      }
    });
  }

  get filteredSuppliers() {
    return this.suppliers.filter(s =>
      s.name?.toLowerCase()
        .includes(this.search.toLowerCase())
    );
  }

  createSupplier() {

    if (!this.newSupplierName.trim()) {
      this.toastr.error('Ingrese un nombre');
      return;
    }

    if (this.creatingSupplier) return;
    this.creatingSupplier = true;

    this.http.post<any>(
      `${API_URL}/suppliers`,
      {
        name: this.newSupplierName,
        description: this.newSupplierDescription
      },
      { headers: this.getHeaders() }
    ).subscribe({
      next: () => {
        this.creatingSupplier = false;
        this.toastr.success('Proveedor creado');

        this.newSupplierName = '';
        this.newSupplierDescription = '';
        this.showCreateModal = false;

        this.loadSuppliers();
      },
      error: (err) => {
        console.error(err);
        this.creatingSupplier = false;
        this.toastr.error(this.getErrorMessage(err, 'No se pudo crear el proveedor'));
        this.cdRef.detectChanges();
      }
    });
  }

  openSupplier(supplier: any) {

    this.selectedSupplier = supplier;

    this.loadInvoices(supplier.id);
  }

  closeSupplier() {

    this.selectedSupplier = null;
    this.invoices = [];

    this.resetInvoiceForm();
  }

  loadInvoices(supplierId: number) {

    this.http.get<any[]>(
      `${API_URL}/suppliers/${supplierId}/invoices`,
      { headers: this.getHeaders() }
    ).subscribe({
      next: (res) => {
        this.invoices = res;
        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error(err);
        this.toastr.error(this.getErrorMessage(err, 'No se pudieron cargar las facturas'));
      }
    });
  }

  createInvoice() {

    if (!this.selectedSupplier) return;

    if (!this.invoiceForm.totalAmount || this.invoiceForm.totalAmount <= 0) {
      this.toastr.warning('Monto inválido');
      return;
    }

    if (this.creatingInvoice) return;
    this.creatingInvoice = true;

    this.http.post<any>(
      `${API_URL}/suppliers/${this.selectedSupplier.id}/invoices`,
      this.invoiceForm,
      { headers: this.getHeaders() }
    ).subscribe({
      next: () => {
        this.creatingInvoice = false;
        this.toastr.success('Factura cargada');

        this.resetInvoiceForm();
        this.loadInvoices(this.selectedSupplier.id);
      },
      error: (err) => {
        console.error(err);
        this.creatingInvoice = false;
        this.toastr.error(this.getErrorMessage(err, 'No se pudo cargar la factura'));
        this.cdRef.detectChanges();
      }
    });
  }

  registerPayment(invoice: any) {
    const amount = this.paymentAmount[invoice.id];
    if (!amount || amount <= 0) {
      this.toastr.warning('Ingrese un importe');
      return;
    }

    if (this.registeringPaymentInvoiceId === invoice.id) return;
    this.registeringPaymentInvoiceId = invoice.id;

    this.http.post<any>(
      `${API_URL}/suppliers/invoices/${invoice.id}/payment`,
      { paidAmount: amount },
      { headers: this.getHeaders() }
    ).subscribe({
      next: () => {
        this.registeringPaymentInvoiceId = null;
        this.toastr.success('Pago registrado');

        this.paymentAmount[invoice.id] = null;

        this.loadInvoices(this.selectedSupplier.id);
      },
      error: (err) => {
        this.registeringPaymentInvoiceId = null;
        this.toastr.error(this.getErrorMessage(err, 'Error registrando pago'));
        this.cdRef.detectChanges();
      }
    });
  }

  deleteInvoice(invoiceId: number) {

    if (!confirm('¿Eliminar factura?')) {
      return;
    }

    if (this.deletingInvoiceId === invoiceId) return;
    this.deletingInvoiceId = invoiceId;

    this.http.delete(
      `${API_URL}/suppliers/invoices/${invoiceId}`,
      { headers: this.getHeaders() }
    ).subscribe({
      next: () => {
        this.deletingInvoiceId = null;
        this.toastr.success('Factura eliminada');
        this.loadInvoices(this.selectedSupplier.id);
        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error(err);
        this.deletingInvoiceId = null;
        this.toastr.error(this.getErrorMessage(err, 'No se pudo eliminar la factura'));
        this.cdRef.detectChanges();
      }
    });
  }

  resetInvoiceForm() {

    this.invoiceForm = {
      invoiceNumber: '',
      invoiceDate: '',
      totalAmount: null,
      paidAmount: null as number | null,
      description: ''
    };
  }

  getTotalPending() {

    return this.invoices.reduce(
      (acc, invoice) =>
        acc + Number(invoice.pendingAmount || 0),
      0
    );
  }

  openEditSupplier(supplier: any, event: Event) {
    event.stopPropagation();

    this.editingSupplier = supplier;
    this.editSupplierName = supplier.name;
    this.editSupplierDescription = supplier.description || '';
  
  }

  cancelEditSupplier() {
    this.editingSupplier = null;
    this.editSupplierName = '';
    this.editSupplierDescription = '';
    this.cdRef.detectChanges();
  }

  updateSupplier() {
    if (!this.editingSupplier) return;

    if (!this.editSupplierName.trim()) {
      this.toastr.error('El nombre es obligatorio');
      return;
    }

    if (this.updatingSupplier) return;
    this.updatingSupplier = true;

    this.http.put<any>(
      `${API_URL}/suppliers/${this.editingSupplier.id}`,
      {
        name: this.editSupplierName,
        description: this.editSupplierDescription
      },
      { headers: this.getHeaders() }
    ).subscribe({
      next: (updated) => {
        this.updatingSupplier = false;
        this.toastr.info('Proveedor actualizado');

        if (this.selectedSupplier && this.selectedSupplier.id === updated.id) {
          this.selectedSupplier = updated;
        }

        this.cancelEditSupplier();
        this.loadSuppliers();
        this.cdRef.detectChanges();
      },
      error: (err) => {
        this.updatingSupplier = false;
        this.toastr.error(this.getErrorMessage(err, 'Error editando proveedor'));
        this.cdRef.detectChanges();
      }
    });
  }

  deleteSupplier(supplier: any, event: Event) {
    event.stopPropagation();

    if (!confirm(`¿Eliminar proveedor ${supplier.name}?`)) {
      return;
    }

    if (this.deletingSupplierId === supplier.id) return;
    this.deletingSupplierId = supplier.id;

    this.http.delete(
      `${API_URL}/suppliers/${supplier.id}`,
      { headers: this.getHeaders() }
    ).subscribe({
      next: () => {
        this.deletingSupplierId = null;
        this.toastr.success('Proveedor eliminado');
        this.loadSuppliers();
        this.cdRef.detectChanges();
      },
      error: (err) => {
        this.deletingSupplierId = null;
        this.toastr.error(this.getErrorMessage(err, 'Error eliminando proveedor'));
        this.cdRef.detectChanges();
      }
    });
  }

  // ───────── Compra con productos ─────────

  openPurchase() {
    if (!this.selectedSupplier) return;

    this.showPurchase = true;
    this.purchaseLines = [];
    this.purchaseSearch = '';
    this.purchaseResults = [];
    this.purchaseRoundTo = 50;
    this.purchaseForm = {
      invoiceNumber: '',
      invoiceDate: this.todayString(),
      paidAmount: null,
      description: ''
    };
    this.loadingPurchaseData = true;

    this.productsService.getProducts('', null, true).subscribe({
      next: (products) => {
        this.purchaseProducts = [...products].sort((a, b) => a.name.localeCompare(b.name));
        this.loadingPurchaseData = false;
        this.cdRef.detectChanges();
      },
      error: (err) => {
        this.loadingPurchaseData = false;
        this.toastr.error(this.getErrorMessage(err, 'No se pudieron cargar los productos'));
        this.cdRef.detectChanges();
      }
    });

    this.http.get<any[]>(`${API_URL}/categories`, { headers: this.getHeaders() }).subscribe({
      next: (cats) => { this.purchaseCategories = cats; this.cdRef.detectChanges(); },
      error: () => { this.purchaseCategories = []; }
    });
  }

  closePurchase() {
    if (this.savingPurchase) return;
    if (this.purchaseLines.length && !confirm('¿Descartar la compra que estás cargando?')) return;
    this.showPurchase = false;
  }

  private todayString(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  onPurchaseSearch() {
    const q = this.purchaseSearch.trim().toLowerCase();
    if (!q) {
      this.purchaseResults = [];
      return;
    }

    const added = new Set(this.purchaseLines.filter(l => l.productId).map(l => l.productId));
    this.purchaseResults = this.purchaseProducts
      .filter(p => !added.has(p.id) && (p.name || '').toLowerCase().includes(q))
      .slice(0, 8);
  }

  // ¿Hay un producto con exactamente ese nombre? (para no ofrecer crearlo de nuevo)
  purchaseExactMatch(): boolean {
    const q = this.purchaseSearch.trim().toLowerCase();
    return !!q && this.purchaseProducts.some(p => (p.name || '').toLowerCase() === q);
  }

  addExistingLine(product: any) {
    const cost = Number(product.costPrice) || 0;
    this.purchaseLines.push({
      productId: product.id,
      name: product.name,
      categoryId: product.category?.id ?? null,
      isNew: false,
      quantity: null,
      unitCost: cost || null,
      oldCost: cost,
      oldPrice: product.price ?? null,
      salePrice: product.price ?? null,
      stock: Number(product.stock) || 0
    });
    this.purchaseSearch = '';
    this.purchaseResults = [];
  }

  addNewLine() {
    const name = this.purchaseSearch.trim();
    if (!name) return;

    if (this.purchaseLines.some(l => l.isNew && l.name.toLowerCase() === name.toLowerCase())) {
      this.toastr.warning('Ese producto nuevo ya está en la compra');
      return;
    }

    this.purchaseLines.push({
      productId: null,
      name,
      categoryId: null,
      isNew: true,
      quantity: null,
      unitCost: null,
      oldCost: 0,
      oldPrice: null,
      salePrice: null,
      stock: 0
    });
    this.purchaseSearch = '';
    this.purchaseResults = [];
  }

  removeLine(index: number) {
    this.purchaseLines.splice(index, 1);
  }

  lineSubtotal(line: PurchaseLine): number {
    return (Number(line.quantity) || 0) * (Number(line.unitCost) || 0);
  }

  purchaseTotal(): number {
    const total = this.purchaseLines.reduce((acc, l) => acc + this.lineSubtotal(l), 0);
    return Math.round(total * 100) / 100;
  }

  costChanged(line: PurchaseLine): boolean {
    return !line.isNew && line.oldCost > 0 && line.unitCost != null &&
      Math.abs(Number(line.unitCost) - line.oldCost) > 0.001;
  }

  // Margen que tenía el producto (precio sobre costo)
  previousMargin(line: PurchaseLine): number | null {
    if (line.isNew || !line.oldCost || !line.oldPrice) return null;
    return Math.round((line.oldPrice / line.oldCost - 1) * 100);
  }

  // Precio de venta que mantiene el margen anterior con el costo nuevo
  suggestedPrice(line: PurchaseLine): number | null {
    if (!this.costChanged(line) || !line.oldPrice) return null;
    const raw = Number(line.unitCost) * (line.oldPrice / line.oldCost);
    const r = Number(this.purchaseRoundTo);
    return r > 1 ? Math.ceil(raw / r) * r : Math.ceil(raw);
  }

  applySuggestion(line: PurchaseLine) {
    const s = this.suggestedPrice(line);
    if (s != null) line.salePrice = s;
  }

  hasSuggestions(): boolean {
    return this.purchaseLines.some(l => this.suggestedPrice(l) != null && this.suggestedPrice(l) !== l.salePrice);
  }

  applyAllSuggestions() {
    this.purchaseLines.forEach(l => this.applySuggestion(l));
  }

  savePurchase() {
    if (!this.selectedSupplier || this.savingPurchase) return;

    if (!this.purchaseLines.length) {
      this.toastr.warning('Agregá al menos un producto');
      return;
    }

    for (const l of this.purchaseLines) {
      if (!(Number(l.quantity) > 0)) {
        this.toastr.warning(`Falta la cantidad de "${l.name}"`);
        return;
      }
      if (l.unitCost == null || Number(l.unitCost) < 0) {
        this.toastr.warning(`Falta el costo de "${l.name}"`);
        return;
      }
      if (l.isNew && (l.salePrice == null || Number(l.salePrice) < 0)) {
        this.toastr.warning(`Falta el precio de venta de "${l.name}"`);
        return;
      }
    }

    const paid = Number(this.purchaseForm.paidAmount) || 0;
    if (paid < 0 || paid > this.purchaseTotal() + 0.01) {
      this.toastr.warning('El pago no puede ser mayor al total de la compra');
      return;
    }

    this.savingPurchase = true;

    this.http.post<any>(
      `${API_URL}/suppliers/${this.selectedSupplier.id}/purchases`,
      {
        invoiceNumber: this.purchaseForm.invoiceNumber,
        invoiceDate: this.purchaseForm.invoiceDate,
        paidAmount: paid,
        description: this.purchaseForm.description,
        items: this.purchaseLines.map(l => ({
          productId: l.productId,
          newName: l.isNew ? l.name : null,
          newCategoryId: l.isNew ? l.categoryId : null,
          quantity: Number(l.quantity),
          unitCost: Number(l.unitCost),
          // Solo se manda si cambia (o si es nuevo)
          salePrice: l.isNew || l.salePrice !== l.oldPrice ? Number(l.salePrice) : null
        }))
      },
      { headers: this.getHeaders() }
    ).subscribe({
      next: () => {
        this.savingPurchase = false;
        this.showPurchase = false;
        this.toastr.success('Compra guardada: se actualizó el stock y los costos');
        this.productsService.invalidateCache();
        this.loadInvoices(this.selectedSupplier.id);
        this.loadSuppliers();
      },
      error: (err) => {
        this.savingPurchase = false;
        this.toastr.error(this.getErrorMessage(err, 'No se pudo guardar la compra'));
        this.cdRef.detectChanges();
      }
    });
  }

  invoiceItemsSummary(invoice: any): string {
    return (invoice.items || [])
      .map((i: any) => `${i.productName} x${i.quantity}`)
      .join(' · ');
  }
}
