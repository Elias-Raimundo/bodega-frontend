import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './customers.html',
  styleUrl: './customers.css'
})
export class Customers implements OnInit {

  customers: any[] = [];
  movements: any[] = [];

  search = '';

  showCreateModal = false;
  showEditModal = false;
  selectedCustomer: any = null;

  newCustomerName = '';

  editCustomerName = '';

  movementAmount: number | null = null;
  movementDescription = '';

  selectedSale: any = null;

  constructor(
    private http: HttpClient,
    private cdRef: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadCustomers();
  }

  getToken() {
    return localStorage.getItem('token');
  }

  getHeaders() {
    return {
      Authorization: `Bearer ${this.getToken()}`
    };
  }

  loadCustomers() {
    this.http.get<any[]>(
      'https://bodega-backend-9c4f.onrender.com/customers',
      { headers: this.getHeaders() }
    ).subscribe({
      next: (res) => {
        this.customers = res;
        this.cdRef.detectChanges();
      },
      error: (err) => console.error('Error cargando clientes:', err)
    });
  }

  get filteredCustomers() {
    return this.customers.filter(c =>
      c.name?.toLowerCase().includes(this.search.toLowerCase())
    );
  }

  createCustomer() {
    if (!this.newCustomerName.trim()) {
      alert('El nombre del cliente es obligatorio');
      return;
    }

    this.http.post<any>(
      'https://bodega-backend-9c4f.onrender.com/customers',
      { name: this.newCustomerName },
      { headers: this.getHeaders() }
    ).subscribe({
      next: () => {
        this.newCustomerName = '';
        this.showCreateModal = false;
        this.loadCustomers();
        this.cdRef.detectChanges();
      },
      error: (err) => console.error('Error creando cliente:', err)
    });
  }

  openEditCustomer(customer: any, event: Event) {
    event.stopPropagation();
    this.editCustomerName = customer.name;
    this.selectedCustomer = customer;
    this.showEditModal = true;
  }

  updateCustomer() {
    if (!this.editCustomerName.trim()) {
      alert('El nombre es obligatorio');
      return;
    }

    this.http.put<any>(
      `https://bodega-backend-9c4f.onrender.com/customers/${this.selectedCustomer.id}`,
      { name: this.editCustomerName },
      { headers: this.getHeaders() }
    ).subscribe({
      next: () => {
        this.showEditModal = false;
        this.selectedCustomer = null;
        this.loadCustomers();
        this.cdRef.detectChanges();
      },
      error: (err) => console.error('Error actualizando cliente:', err)
    });
  }

  deleteCustomer(customer: any, event: Event) {
    event.stopPropagation();
    if (!confirm(`¿Eliminar a ${customer.name}? Se borrarán todos sus movimientos.`)) return;

    this.http.delete(
      `https://bodega-backend-9c4f.onrender.com/customers/${customer.id}`,
      { headers: this.getHeaders() }
    ).subscribe({
      next: () => {
        this.loadCustomers();
        this.cdRef.detectChanges();
      },
      error: (err) => console.error('Error eliminando cliente:', err)
    });
  }

  openCustomer(customer: any) {
    this.selectedCustomer = customer;
    this.movementAmount = null;
    this.movementDescription = '';
    this.loadMovements(customer.id);
  }

  closeCustomer() {
    this.selectedCustomer = null;
    this.selectedSale = null;
    this.movements = [];
    this.movementAmount = null;
    this.movementDescription = '';
  }

  loadMovements(customerId: number) {
    this.http.get<any[]>(
      `https://bodega-backend-9c4f.onrender.com/customers/${customerId}/movements`,
      { headers: this.getHeaders() }
    ).subscribe({
      next: (res) => {
        this.movements = res;
        this.cdRef.detectChanges();
      },
      error: (err) => console.error('Error cargando movimientos:', err)
    });
  }

  addDebt() {
    if (!this.selectedCustomer) return;
    if (!this.movementAmount || this.movementAmount <= 0) {
      alert('El importe debe ser mayor a cero');
      return;
    }

    this.http.post<any>(
      `https://bodega-backend-9c4f.onrender.com/customers/${this.selectedCustomer.id}/debt`,
      { amount: this.movementAmount, description: this.movementDescription },
      { headers: this.getHeaders() }
    ).subscribe({
      next: (res) => {
        this.selectedCustomer = res;
        this.movementAmount = null;
        this.movementDescription = '';
        this.loadCustomers();
        this.loadMovements(res.id);
        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error('Error agregando deuda:', err);
        alert(err.error?.message || 'Error agregando deuda');
      }
    });
  }

  addPayment() {
    if (!this.selectedCustomer) return;
    if (!this.movementAmount || this.movementAmount <= 0) {
      alert('El importe debe ser mayor a cero');
      return;
    }

    this.http.post<any>(
      `https://bodega-backend-9c4f.onrender.com/customers/${this.selectedCustomer.id}/payment`,
      { amount: this.movementAmount, description: this.movementDescription },
      { headers: this.getHeaders() }
    ).subscribe({
      next: (res) => {
        this.selectedCustomer = res;
        this.movementAmount = null;
        this.movementDescription = '';
        this.loadCustomers();
        this.loadMovements(res.id);
        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error('Error registrando pago:', err);
        alert(err.error?.message || 'Error registrando pago');
      }
    });
  }

  getTotalDebt() {
    return this.customers.reduce(
      (acc, c) => acc + Number(c.balance || 0),
      0
    );
  }

  getMovementLabel(type: string) {
    if (type === 'DEBT') return 'Deuda';
    if (type === 'PAYMENT') return 'Pago';
    return type;
  }

  openSaleDetail(saleId: number) {
    this.http.get<any>(
      `https://bodega-backend-9c4f.onrender.com/sales/${saleId}`,
      { headers: this.getHeaders() }
    ).subscribe({
      next: (res) => {
        this.selectedSale = res;
        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error('Error cargando venta:', err);
        alert('No se pudo cargar el detalle de la venta');
      }
    });
  }

  closeSaleDetail() {
    this.selectedSale = null;
  }
}