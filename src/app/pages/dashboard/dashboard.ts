import { Component, getPlatform, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef } from '@angular/core';
import { ProductsService } from '../../products.service';
import { PreparedProductsService } from '../../prepared-products.service';

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

  products: any[] = [];

  loadingStats = false;
  loadingSales = false;

  constructor(private router: Router, 
    private http: HttpClient, 
    private cdRef: ChangeDetectorRef,
    private productsService: ProductsService,
    private preparedProductsService: PreparedProductsService
  ) {}

  ngOnInit(){
      this.loadStats();
      this.loadSales();
      this.loadPaymentStats();
      this.loadProducts();
  }
      

  loadStats() {
    const token = localStorage.getItem('token');
    this.loadingStats = true;
    this.cdRef.detectChanges();

    this.http.get('https://bodega-backend-9c4f.onrender.com/products/stats', {
      headers: { 'Authorization': `Bearer ${token}` }
    }).subscribe({
      next: (res: any) => {
        this.stats = { ...res };
        this.loadingStats = false;
        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error('Error stats:', err);
        this.loadingStats = false;
        this.cdRef.detectChanges();
      }
    });
  }

  loadSales() {
    const token = localStorage.getItem('token');
    this.loadingSales = true;
    this.cdRef.detectChanges();

    this.http.get('https://bodega-backend-9c4f.onrender.com/sales', {
      headers: { 'Authorization': `Bearer ${token}` }
    }).subscribe({
      next: (res: any) => {
        this.sales = res;
        this.loadingSales = false;
        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error('Error sales:', err);
        this.loadingSales = false;
        this.cdRef.detectChanges();
      }
    });
  }

  loadPaymentStats() {

    const token = localStorage.getItem('token');

    this.http.get(
      'https://bodega-backend-9c4f.onrender.com/sales/payment-stats',
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    ).subscribe({
      next: (res: any) => {

        this.paymentStats = res;

        this.cdRef.detectChanges();
      },

      error: (err) => {
        console.error(err);
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

  lowStockProducts(): any[] {
    return this.products
      .filter(p =>
          p.stock <= 5
      )
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 5);
  }

  loadProducts() {

    const token = localStorage.getItem('token');

    this.http.get<any[]>(
      'https://bodega-backend-9c4f.onrender.com/products',
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    ).subscribe({
      next: (res) => {
        this.products = res;
        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error('Error loading products:', err);
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