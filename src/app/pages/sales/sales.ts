import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-sales',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sales.html',
  styleUrl: './sales.css'
})
export class Sales implements OnInit {

  products: any[] = [];

  cart: any[] = [];
  search = '';
  discount = 0;
  categories: any[] = [];
  selectedCategoryId: number | null = null;

  payments = [
    {
      method: 'CASH',
      amount: 0
    }
  ];

  constructor(
    private http: HttpClient,
    private cd: ChangeDetectorRef,
    private toastr: ToastrService
  ) {}

  ngOnInit() {
    this.loadProducts();

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

        this.categories = [
          ...new Map(
            res
              .filter(p => p.category)
              .map(p => [p.category.id, p.category])
          ).values()
        ].sort((a: any, b: any) =>
          a.name.localeCompare(b.name)
        );

        this.cd.detectChanges();
      },
      error: (err) => {
        console.error('Error fetching products:', err);
      }
    });
  }


  get filteredProducts() {
    return this.products
      .filter(p =>
        p.name.toLowerCase()
          .includes(this.search.toLowerCase())
      )
      .filter(p =>
        this.selectedCategoryId === null ||
        p.category?.id === this.selectedCategoryId
      );
  }


  addProductToCart(product: any) {
    const existing = this.cart.find(
      p => p.itemType === 'PRODUCT' && p.productId === product.id
    );

    if (existing) {
      if (existing.quantity >= product.stock) return;
      existing.quantity++;
    } else {
      if (product.stock <= 0) return;

      this.cart.push({
        itemType: 'PRODUCT',
        productId: product.id,
        name: product.name,
        quantity: 1,
        price: product.price,
        stock: product.stock
      });
    }
  }


  checkout() {
    if (this.cart.length === 0) {
      return;
    }

    if (Math.abs(this.getPaymentsTotal() - this.getTotal()) > 0.01) {
      this.toastr.warning('El total pagado no coincide');
      return;
    }

    const token = localStorage.getItem('token');

    const items = this.cart.map(p => ({
      itemType: p.itemType,
      productId: p.itemType === 'PRODUCT' ? p.productId : null,
      preparedProductId:
        p.itemType === 'PREPARED'
          ? p.preparedProductId
          : null,
      quantity: p.quantity
    }));

    this.http.post(
      'https://bodega-backend-9c4f.onrender.com/sales',
      {
        items,
        payments: this.payments,
        discount: Number(this.discount) || 0
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    ).subscribe({
      next: () => {
        this.handleSuccess();
        this.cd.detectChanges();
      },
      error: (err) => {
        console.error('Error backend:', err);
        this.toastr.error('Error al realizar la venta');
        this.cd.detectChanges();
      }
    });
  }

  handleSuccess() {
    this.toastr.success('Venta realizada');

    this.cart = [];
    this.discount = 0;
    this.payments = [
      {
        method: 'CASH',
        amount: 0
      }
    ];

    this.loadProducts();
    // this.loadPreparedProducts();
  }

  increase(item: any) {
    if (item.itemType === 'PRODUCT') {
      if (item.quantity < item.stock) {
        item.quantity++;
      }
      return;
    }

    item.quantity++;
  }

  decrease(item: any) {
    item.quantity--;

    if (item.quantity <= 0) {
      this.remove(item);
    }
  }

  trackById(index: number, item: any) {
    return `${item.itemType}-${item.productId || item.preparedProductId}`;
  }

  groupedProducts() {
    const groups: any = {};

    this.filteredProducts.forEach(p => {
      const category = p.category?.name || 'Sin categoria';

      if (!groups[category]) {
        groups[category] = [];
      }

      groups[category].push(p);
    });

    return groups;
  }

  remove(item: any) {
    this.cart = this.cart.filter(p =>
      !(
        p.itemType === item.itemType &&
        p.productId === item.productId &&
        p.preparedProductId === item.preparedProductId
      )
    );
  }

  addPayment() {
    this.payments.push({
      method: 'TRANSFER',
      amount: 0
    });
  }

  removePayment(index: number) {
    if (this.payments.length === 1) {
      return;
    }

    this.payments.splice(index, 1);
  }

  getPaymentsTotal() {
    return this.payments.reduce(
      (acc, p) => acc + Number(p.amount),
      0
    );
  }

  paymentMethods() {
    return Math.abs(this.getPaymentsTotal() - this.getTotal()) <= 0.01 ;
  }

  getSubtotal(){
    return this.cart.reduce(
      (acc, p) => acc + p.quantity * p.price,
      0
    );
  }

  getTotal(){
    const subtotal = this.getSubtotal();
    const discount = Number(this.discount) || 0;

    return Math.max(subtotal - discount, 0);
  }
}