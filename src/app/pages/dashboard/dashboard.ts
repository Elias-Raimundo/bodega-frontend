import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { ProductsService } from '../../products.service';
import { PreparedProductsService } from '../../prepared-products.service';

const API_URL = 'https://bodega-backend-9c4f.onrender.com';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard implements OnInit {

  stats: any = null;
  sales: any[] = [];
  paymentStats: any = null;

  // CAMBIO: ya no guardamos "products" crudo, guardamos el resultado
  // ya filtrado/ordenado, calculado una sola vez al llegar la data.
  lowStock: any[] = [];

  loadingStats = false;
  loadingSales = false;
  loadingProducts = false; // NUEVO: para mostrar loading si hace falta en el html

  constructor(
    private router: Router,
    private http: HttpClient,
    private cdRef: ChangeDetectorRef,
    private toastr: ToastrService,
    private productsService: ProductsService,
    private preparedProductsService: PreparedProductsService
  ) {}

  ngOnInit() {
    this.loadStats();
    this.loadSales();
    this.loadPaymentStats();
    this.loadProducts();
  }

  getHeaders() {
    const token = localStorage.getItem('token');
    return { Authorization: `Bearer ${token}` };
  }

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

  loadStats() {
    this.loadingStats = true;
    this.cdRef.detectChanges();

    this.http.get(`${API_URL}/products/stats`, {
      headers: this.getHeaders()
    }).subscribe({
      next: (res: any) => {
        this.stats = { ...res };
        this.loadingStats = false;
        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error('Error stats:', err);
        this.toastr.error(this.getErrorMessage(err, 'No se pudo cargar el resumen del negocio'));
        this.loadingStats = false;
        this.cdRef.detectChanges();
      }
    });
  }

  loadSales() {
    this.loadingSales = true;
    this.cdRef.detectChanges();

    this.http.get(`${API_URL}/sales`, {
      headers: this.getHeaders()
    }).subscribe({
      next: (res: any) => {
        this.sales = res;
        this.loadingSales = false;
        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error('Error sales:', err);
        this.toastr.error(this.getErrorMessage(err, 'No se pudieron cargar las últimas ventas'));
        this.loadingSales = false;
        this.cdRef.detectChanges();
      }
    });
  }

  loadPaymentStats() {
    this.http.get(
      `${API_URL}/sales/payment-stats`,
      { headers: this.getHeaders() }
    ).subscribe({
      next: (res: any) => {
        this.paymentStats = res;
        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error(err);
        this.toastr.error(this.getErrorMessage(err, 'No se pudieron cargar los métodos de pago'));
      }
    });
  }

  getPaymentMethodLabel(method: string): string {
    switch (method) {
      case 'CASH':
        return 'Efectivo';
      case 'TRANSFER':
        return 'Transferencia';
      case 'DEBIT':
        return 'Débito';
      case 'CREDIT':
        return 'Crédito';
      case 'CURRENT_ACCOUNT':
        return 'Cuenta Corriente';
      default:
        return method;
    }
  }

  // CAMBIO: ahora usa el ProductsService (con su cache) en vez de
  // pegarle directo al backend con HttpClient crudo. Si el usuario
  // ya visitó "Productos" en esta sesión, esto no dispara ningún
  // request nuevo — usa lo que ya está en memoria.
  loadProducts() {
    this.loadingProducts = true;
    this.cdRef.detectChanges();

    this.productsService.getProducts().subscribe({
      next: (res) => {
        // CAMBIO: el filtro/orden se calcula una sola vez acá,
        // no en cada ciclo de detección de cambios como antes.
        this.lowStock = res
          .filter(p => p.stock <= 5)
          .sort((a, b) => a.stock - b.stock)
          .slice(0, 5);

        this.loadingProducts = false;
        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error('Error loading products:', err);
        this.toastr.error(this.getErrorMessage(err, 'No se pudieron cargar los productos'));
        this.loadingProducts = false;
        this.cdRef.detectChanges();
      }
    });
  }

  logout() {
    localStorage.removeItem('token');
    this.productsService.invalidateCache();
    this.preparedProductsService.invalidateCache();
    this.router.navigate(['/login']);
  }
}