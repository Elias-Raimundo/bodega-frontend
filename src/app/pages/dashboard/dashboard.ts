import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { ToastrService } from 'ngx-toastr';
import { forkJoin } from 'rxjs';
import { ProductsService } from '../../products.service';
import { PreparedProductsService } from '../../prepared-products.service';

const API_URL = 'https://bodega-backend-9c4f.onrender.com';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush   // clave para dejar de usar detectChanges a mano
})
export class Dashboard implements OnInit {

  stats: any = null;
  sales: any[] = [];
  paymentStats: any = null;
  lowStock: any[] = [];

  loading = true; // un solo flag: la primera pintura es la que importa

  constructor(
    private router: Router,
    private http: HttpClient,
    private cdRef: ChangeDetectorRef,
    private toastr: ToastrService,
    private productsService: ProductsService,
    private preparedProductsService: PreparedProductsService
  ) {}

  ngOnInit() {
    this.loadDashboard();
  }

  getHeaders() {
    const token = localStorage.getItem('token');
    return { Authorization: `Bearer ${token}` };
  }

  private getErrorMessage(err: HttpErrorResponse, fallback: string): string {
    if (err.status === 0) return 'No se pudo conectar con el servidor. Revisá tu conexión a internet.';
    if (typeof err.error === 'string' && err.error.trim()) return err.error;
    if (err.error?.message) {
      return Array.isArray(err.error.message) ? err.error.message.join(', ') : err.error.message;
    }
    if (err.status === 401) return 'Tu sesión expiró. Iniciá sesión de nuevo.';
    return fallback;
  }

  loadDashboard() {
    this.loading = true;

    forkJoin({
      stats: this.http.get<any>(`${API_URL}/products/stats`, { headers: this.getHeaders() }),
      sales: this.http.get<any[]>(`${API_URL}/sales?limit=5`, { headers: this.getHeaders() }),
      paymentStats: this.http.get<any>(`${API_URL}/sales/payment-stats`, { headers: this.getHeaders() }),
      // pedile al backend solo lo que necesitás, no 360 productos
      lowStock: this.http.get<any[]>(`${API_URL}/products?lowStock=true&limit=5`, { headers: this.getHeaders() })
    }).subscribe({
      next: ({ stats, sales, paymentStats, lowStock }) => {
        this.stats = stats;
        this.sales = sales;
        this.paymentStats = paymentStats;
        this.lowStock = lowStock;
        this.loading = false;
        this.cdRef.markForCheck();
      },
      error: (err) => {
        console.error('Error cargando dashboard:', err);
        this.toastr.error(this.getErrorMessage(err, 'No se pudo cargar el dashboard'));
        this.loading = false;
        this.cdRef.markForCheck();
      }
    });
  }

  getPaymentMethodLabel(method: string): string {
    switch (method) {
      case 'CASH': return 'Efectivo';
      case 'TRANSFER': return 'Transferencia';
      case 'DEBIT': return 'Débito';
      case 'CREDIT': return 'Crédito';
      case 'CURRENT_ACCOUNT': return 'Cuenta Corriente';
      default: return method;
    }
  }

  logout() {
    localStorage.removeItem('token');
    this.productsService.invalidateCache();
    this.preparedProductsService.invalidateCache();
    this.router.navigate(['/login']);
  }
}