import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';

const API_URL = 'https://bodega-backend-9c4f.onrender.com';
// TODO: mover a environment.ts, mismo comentario que en los demás componentes

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

  // NUEVO: flags de carga para evitar doble submit
  creatingCustomer = false;
  updatingCustomer = false;
  deletingCustomerId: number | null = null;
  addingDebt = false;
  addingPayment = false;

  constructor(
    private http: HttpClient,
    private cdRef: ChangeDetectorRef,
    private toastr: ToastrService
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

  loadCustomers() {
    this.http.get<any[]>(
      `${API_URL}/customers`,
      { headers: this.getHeaders() }
    ).subscribe({
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

  get filteredCustomers() {
    return this.customers.filter(c =>
      c.name?.toLowerCase().includes(this.search.toLowerCase())
    );
  }

  createCustomer() {
    if (!this.newCustomerName.trim()) {
      this.toastr.error('El nombre del cliente es obligatorio');
      return;
    }

    if (this.creatingCustomer) return;
    this.creatingCustomer = true;

    this.http.post<any>(
      `${API_URL}/customers`,
      { name: this.newCustomerName },
      { headers: this.getHeaders() }
    ).subscribe({
      next: () => {
        this.creatingCustomer = false;
        this.toastr.success('Cliente creado');
        this.newCustomerName = '';
        this.showCreateModal = false;
        this.loadCustomers();
        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error('Error creando cliente:', err);
        this.creatingCustomer = false;
        this.toastr.error(this.getErrorMessage(err, 'No se pudo crear el cliente'));
        this.cdRef.detectChanges();
      }
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
      this.toastr.error('El nombre es obligatorio');
      return;
    }

    if (this.updatingCustomer) return;
    this.updatingCustomer = true;

    this.http.put<any>(
      `${API_URL}/customers/${this.selectedCustomer.id}`,
      { name: this.editCustomerName },
      { headers: this.getHeaders() }
    ).subscribe({
      next: () => {
        this.updatingCustomer = false;
        this.toastr.info('Cliente actualizado');
        this.showEditModal = false;
        this.selectedCustomer = null;
        this.loadCustomers();
        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error('Error actualizando cliente:', err);
        this.updatingCustomer = false;
        this.toastr.error(this.getErrorMessage(err, 'No se pudo actualizar el cliente'));
        this.cdRef.detectChanges();
      }
    });
  }

  deleteCustomer(customer: any, event: Event) {
    event.stopPropagation();
    if (!confirm(`¿Eliminar a ${customer.name}? Se borrarán todos sus movimientos.`)) return;

    if (this.deletingCustomerId === customer.id) return;
    this.deletingCustomerId = customer.id;

    this.http.delete(
      `${API_URL}/customers/${customer.id}`,
      { headers: this.getHeaders() }
    ).subscribe({
      next: () => {
        this.deletingCustomerId = null;
        this.toastr.success('Cliente eliminado');
        this.loadCustomers();
        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error('Error eliminando cliente:', err);
        this.deletingCustomerId = null;
        this.toastr.error(this.getErrorMessage(err, 'No se pudo eliminar el cliente'));
        this.cdRef.detectChanges();
      }
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
      `${API_URL}/customers/${customerId}/movements`,
      { headers: this.getHeaders() }
    ).subscribe({
      next: (res) => {
        this.movements = res;
        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error('Error cargando movimientos:', err);
        this.toastr.error(this.getErrorMessage(err, 'No se pudieron cargar los movimientos'));
      }
    });
  }

  addDebt() {
    if (!this.selectedCustomer) return;
    if (!this.movementAmount || this.movementAmount <= 0) {
      this.toastr.warning('El importe debe ser mayor a cero');
      return;
    }

    if (this.addingDebt) return;
    this.addingDebt = true;

    this.http.post<any>(
      `${API_URL}/customers/${this.selectedCustomer.id}/debt`,
      { amount: this.movementAmount, description: this.movementDescription },
      { headers: this.getHeaders() }
    ).subscribe({
      next: (res) => {
        this.addingDebt = false;
        this.toastr.success('Deuda agregada');
        this.selectedCustomer = res;
        this.movementAmount = null;
        this.movementDescription = '';
        this.loadCustomers();
        this.loadMovements(res.id);
        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error('Error agregando deuda:', err);
        this.addingDebt = false;
        this.toastr.error(this.getErrorMessage(err, 'Error agregando deuda'));
        this.cdRef.detectChanges();
      }
    });
  }

  addPayment() {
    if (!this.selectedCustomer) return;
    if (!this.movementAmount || this.movementAmount <= 0) {
      this.toastr.warning('El importe debe ser mayor a cero');
      return;
    }

    if (this.addingPayment) return;
    this.addingPayment = true;

    this.http.post<any>(
      `${API_URL}/customers/${this.selectedCustomer.id}/payment`,
      { amount: this.movementAmount, description: this.movementDescription },
      { headers: this.getHeaders() }
    ).subscribe({
      next: (res) => {
        this.addingPayment = false;
        this.toastr.success('Pago registrado');
        this.selectedCustomer = res;
        this.movementAmount = null;
        this.movementDescription = '';
        this.loadCustomers();
        this.loadMovements(res.id);
        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error('Error registrando pago:', err);
        this.addingPayment = false;
        this.toastr.error(this.getErrorMessage(err, 'Error registrando pago'));
        this.cdRef.detectChanges();
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
      `${API_URL}/sales/${saleId}`,
      { headers: this.getHeaders() }
    ).subscribe({
      next: (res) => {
        this.selectedSale = res;
        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error('Error cargando venta:', err);
        this.toastr.error(this.getErrorMessage(err, 'No se pudo cargar el detalle de la venta'));
      }
    });
  }

  closeSaleDetail() {
    this.selectedSale = null;
  }
}