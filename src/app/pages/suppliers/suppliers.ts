import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

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

  invoiceForm = {
    invoiceNumber: '',
    invoiceDate: '',
    totalAmount: null as number | null,
    paidAmount: 0,
    description: ''
  };

  paymentAmount: number | null = null;

  constructor(
    private http: HttpClient,
    private cdRef: ChangeDetectorRef
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

  loadSuppliers() {
    this.http.get<any[]>(
      'https://bodega-backend-9c4f.onrender.com/suppliers',
      {
        headers: this.getHeaders()
      }
    ).subscribe({
      next: (res) => {
        this.suppliers = res;
        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error(err);
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
      alert('Ingrese un nombre');
      return;
    }

    this.http.post<any>(
      'https://bodega-backend-9c4f.onrender.com/suppliers',
      {
        name: this.newSupplierName,
        description: this.newSupplierDescription
      },
      {
        headers: this.getHeaders()
      }
    ).subscribe({
      next: () => {

        this.newSupplierName = '';
        this.newSupplierDescription = '';
        this.showCreateModal = false;

        this.loadSuppliers();
      },
      error: (err) => {
        console.error(err);
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
      `https://bodega-backend-9c4f.onrender.com/suppliers/${supplierId}/invoices`,
      {
        headers: this.getHeaders()
      }
    ).subscribe({
      next: (res) => {
        this.invoices = res;
        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error(err);
      }
    });
  }

  createInvoice() {

    if (!this.selectedSupplier) return;

    if (!this.invoiceForm.totalAmount || this.invoiceForm.totalAmount <= 0) {
      alert('Monto inválido');
      return;
    }

    this.http.post<any>(
      `https://bodega-backend-9c4f.onrender.com/suppliers/${this.selectedSupplier.id}/invoices`,
      this.invoiceForm,
      {
        headers: this.getHeaders()
      }
    ).subscribe({
      next: () => {

        this.resetInvoiceForm();
        this.loadInvoices(this.selectedSupplier.id);
      },
      error: (err) => {
        console.error(err);
      }
    });
  }

  registerPayment(invoice: any) {

    if (!this.paymentAmount || this.paymentAmount <= 0) {
      alert('Ingrese un importe');
      return;
    }

    this.http.post<any>(
      `https://bodega-backend-9c4f.onrender.com/suppliers/invoices/${invoice.id}/payment`,
      {
        paidAmount: this.paymentAmount
      },
      {
        headers: this.getHeaders()
      }
    ).subscribe({
      next: () => {

        this.paymentAmount = null;

        this.loadInvoices(this.selectedSupplier.id);
      },
      error: (err) => {
        alert(
          err.error?.message ||
          'Error registrando pago'
        );
      }
    });
  }

  deleteInvoice(invoiceId: number) {

    if (!confirm('¿Eliminar factura?')) {
      return;
    }

    this.http.delete(
      `https://bodega-backend-9c4f.onrender.com/suppliers/invoices/${invoiceId}`,
      {
        headers: this.getHeaders()
      }
    ).subscribe({
      next: () => {
        this.loadInvoices(this.selectedSupplier.id);
      },
      error: (err) => {
        console.error(err);
      }
    });
  }

  resetInvoiceForm() {

    this.invoiceForm = {
      invoiceNumber: '',
      invoiceDate: '',
      totalAmount: null,
      paidAmount: 0,
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
}