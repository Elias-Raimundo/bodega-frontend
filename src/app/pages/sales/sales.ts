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
  customers: any[] = [];
  checkoutAttempted = false;

  cart: any[] = [];
  search = '';
  discount = 0;
  categories: any[] = [];
  selectedCategoryId: number | null = null;
  filteredProducts: any[] = [];
  groupedProductsMap: any = {};
  selectedCustomerId: number | null = null;
  newCustomerName = '';

  loadingProducts = false;

  searchTimeout: any = null;

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
    this.loadCart();
    this.loadProducts();
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

  loadProducts(search: string = '') {
    const url = search
      ? `https://bodega-backend-9c4f.onrender.com/products?search=${encodeURIComponent(search)}`
      : 'https://bodega-backend-9c4f.onrender.com/products';

    this.loadingProducts = true; 
    this.cd.detectChanges();

    this.http.get<any[]>(url, { headers: this.getHeaders() })
      .subscribe({
        next: (res) => {
          this.products = res;
          this.categories = [
            ...new Map(
              res
                .filter(p => p.category)
                .map(p => [p.category.id, p.category])
            ).values()
          ].sort((a: any, b: any) => a.name.localeCompare(b.name));
          this.updateFilteredProducts();
          this.loadingProducts = false; 
          this.cd.detectChanges();
        },
        error: (err) => {
          console.error('Error fetching products:', err);
          this.loadingProducts = false; 
          this.cd.detectChanges();
        }
      });
  }

  loadCustomers() {
    this.http.get<any[]>(
      'https://bodega-backend-9c4f.onrender.com/customers',
      {
        headers: this.getHeaders()
      }
    ).subscribe({
      next: (res) => {
        this.customers = res;
        this.cd.detectChanges();
      },
      error: (err) => {
        console.error('Error cargando clientes:', err);
      }
    });
  }

  updateFilteredProducts() {
    this.filteredProducts = this.products.filter(p =>
      this.selectedCategoryId === null ||
      p.category?.id === this.selectedCategoryId
    );

    const groups: any = {};
    this.filteredProducts.forEach(p => {
      const category = p.category?.name || 'Sin categoria';
      if (!groups[category]) groups[category] = [];
      groups[category].push(p);
    });
    this.groupedProductsMap = groups;
    this.cd.detectChanges();
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

    this.saveCart();
  }

  onSearchChange() {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.loadProducts(this.search);
    }, 300);
  }

  checkout() {
    this.checkoutAttempted = true;

    if (this.cart.length === 0) {
      this.toastr.warning('Agregá al menos un producto');
      return;
    }

    if (this.payments.some(p => Number(p.amount) <= 0)) {
      this.toastr.warning('Todos los pagos deben tener un monto mayor a cero');
      return;
    }

    if (this.hasCurrentAccountPayment() && !this.selectedCustomerId) {
      this.toastr.warning('Debe seleccionar un cliente para cuenta corriente');
      return;
    }

    if (Math.abs(this.getPaymentsTotal() - this.getTotal()) > 0.01) {
      this.toastr.warning('El total pagado no coincide');
      return;
    }

    const items = this.cart.map(p => ({
      itemType: p.itemType,
      productId: p.itemType === 'PRODUCT' ? p.productId : null,
      preparedProductId:
        p.itemType === 'PREPARED'
          ? p.preparedProductId
          : null,
      quantity: p.quantity
    }));

    this.http.post<any>(
      'https://bodega-backend-9c4f.onrender.com/sales',
      {
        items,
        payments: this.payments,
        discount: Number(this.discount) || 0,
        customerId: this.hasCurrentAccountPayment()
          ? this.selectedCustomerId
          : null
      },
      {
        headers: this.getHeaders()
      }
    ).subscribe({
      next: (res) => {
        if (!res || !res.id) {
          this.toastr.error('La venta no se guardó correctamente');
          return;
        }

        this.handleSuccess();
        this.cd.detectChanges();
      },
      error: (err) => {
        console.error('Error backend:', err);
        this.toastr.error(
          err.error?.message || err.error || 'Error al realizar la venta'
        );
        this.cd.detectChanges();
      }
    });
  }

  handleSuccess() {
    this.checkoutAttempted = false;
    this.toastr.success('Venta realizada');

    this.cart = [];
    this.discount = 0;
    this.selectedCustomerId = null;
    this.newCustomerName = '';

    this.payments = [
      {
        method: 'CASH',
        amount: 0
      }
    ];

    this.clearCartStorage();
    this.loadProducts();
    this.loadCustomers();
  }

  increase(item: any) {
    if (item.itemType === 'PRODUCT') {
      if (item.quantity < item.stock) {
        item.quantity++;
        this.saveCart();
      }
      return;
    }

    item.quantity++;
    this.saveCart();
  }

  decrease(item: any) {
    item.quantity--;

    if (item.quantity <= 0) {
      this.remove(item);
      return;
    }

    this.saveCart();
  }

  trackById(index: number, item: any) {
    return `${item.itemType}-${item.productId || item.preparedProductId}`;
  }

  remove(item: any) {
    this.cart = this.cart.filter(p =>
      !(
        p.itemType === item.itemType &&
        p.productId === item.productId &&
        p.preparedProductId === item.preparedProductId
      )
    );

    this.saveCart();
  }

  addPayment() {
    this.payments.push({
      method: 'TRANSFER',
      amount: 0
    });

    this.saveCart();
  }

  removePayment(index: number) {
    if (this.payments.length === 1) {
      return;
    }

    this.payments.splice(index, 1);

    if (!this.hasCurrentAccountPayment()) {
      this.selectedCustomerId = null;
    }

    this.saveCart();
  }

  getPaymentsTotal() {
    return this.payments.reduce(
      (acc, p) => acc + Number(p.amount),
      0
    );
  }

  paymentMethods() {
    return Math.abs(this.getPaymentsTotal() - this.getTotal()) <= 0.01;
  }

  hasCurrentAccountPayment() {
    return this.payments.some(
      p => p.method === 'CURRENT_ACCOUNT'
    );
  }

  createQuickCustomer() {
    if (!this.newCustomerName.trim()) {
      this.toastr.warning('Ingrese el nombre del cliente');
      return;
    }

    this.http.post<any>(
      'https://bodega-backend-9c4f.onrender.com/customers',
      {
        name: this.newCustomerName
      },
      {
        headers: this.getHeaders()
      }
    ).subscribe({
      next: (res) => {
        this.customers.push(res);
        this.selectedCustomerId = res.id;
        this.newCustomerName = '';
        this.saveCart();
        this.toastr.success('Cliente creado');
        this.cd.detectChanges();
      },
      error: (err) => {
        console.error('Error creando cliente:', err);
        this.toastr.error(
          err.error?.message || err.error || 'Error creando cliente'
        );
      }
    });
  }

  getSubtotal() {
    return this.cart.reduce(
      (acc, p) => acc + p.quantity * p.price,
      0
    );
  }

  getTotal() {
    const subtotal = this.getSubtotal();
    const discount = Number(this.discount) || 0;

    return Math.max(subtotal - discount, 0);
  }

  saveCart() {
    localStorage.setItem(
      'sales_cart',
      JSON.stringify({
        cart: this.cart,
        payments: this.payments,
        discount: this.discount,
        selectedCustomerId: this.selectedCustomerId
      })
    );
  }

  loadCart() {
    const saved = localStorage.getItem('sales_cart');

    if (!saved) return;

    const data = JSON.parse(saved);

    this.cart = data.cart || [];

    this.payments = data.payments || [
      {
        method: 'CASH',
        amount: 0
      }
    ];

    this.discount = data.discount || 0;
    this.selectedCustomerId = data.selectedCustomerId || null;
  }

  clearCartStorage() {
    localStorage.removeItem('sales_cart');
  }

  toNumber(val: any): number {
    return Number(val);
  }
}