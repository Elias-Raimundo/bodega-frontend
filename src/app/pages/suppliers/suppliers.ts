import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';

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

  constructor(
    private http: HttpClient,
    private cdRef: ChangeDetectorRef,
    private toastr: ToastrService
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
}