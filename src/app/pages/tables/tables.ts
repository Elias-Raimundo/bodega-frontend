import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-tables',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tables.html',
  styleUrl: './tables.css'
})
export class Tables implements OnInit {

  tables: any[] = [];
  products: any[] = [];
  preparedProducts: any[] = [];

  tableCount = 10;

  selectedTable: any = null;
  selectedOrder: any = null;

  search = '';

  payments = [
    {
      method: 'CASH',
      amount: 0
    }
  ];

  constructor(
    private http: HttpClient,
    private cdRef: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadTables();
    this.loadProducts();
    this.loadPreparedProducts();
  }

  getToken() {
    return localStorage.getItem('token');
  }

  loadTables() {
    const token = this.getToken();

    this.http.get<any[]>('https://bodega-backend-9c4f.onrender.com/tables', {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: (res) => {
        this.tables = res;
        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error('Error cargando mesas:', err);
      }
    });
  }

  loadProducts() {
    const token = this.getToken();

    this.http.get<any[]>('https://bodega-backend-9c4f.onrender.com/products', {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: (res) => {
        this.products = res;
        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error('Error cargando productos:', err);
      }
    });
  }

  loadPreparedProducts() {
    const token = this.getToken();

    this.http.get<any[]>('https://bodega-backend-9c4f.onrender.com/prepared-products', {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: (res) => {
        this.preparedProducts = res;
        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error('Error cargando preparados:', err);
      }
    });
  }

  initTables() {
    const token = this.getToken();

    this.http.post<any[]>(
      `https://bodega-backend-9c4f.onrender.com/tables/init?count=${this.tableCount}`,
      {},
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    ).subscribe({
      next: () => {
        this.loadTables();
      },
      error: (err) => {
        console.error('Error creando mesas:', err);
      }
    });
  }

  openTable(table: any) {
    const token = this.getToken();

    this.selectedTable = table;

    this.http.get<any>(
      `https://bodega-backend-9c4f.onrender.com/tables/${table.id}/order`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    ).subscribe({
      next: (res) => {
        this.selectedOrder = res;

        this.loadTables();

        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error('Error abriendo mesa:', err);
      }
    });
  }

  refreshCurrentOrder() {
    if (!this.selectedTable) return;

    const token = this.getToken();

    this.http.get<any>(
      `https://bodega-backend-9c4f.onrender.com/tables/${this.selectedTable.id}/order`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    ).subscribe({
      next: (res) => {
        this.selectedOrder = res;
        this.loadTables();
        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error('Error refrescando pedido:', err);
      }
    });
  }

  addProductToTable(product: any) {
    this.addItemToTable({
      itemType: 'PRODUCT',
      productId: product.id,
      preparedProductId: null,
      quantity: 1
    });
  }

  addPreparedToTable(prepared: any) {
    this.addItemToTable({
      itemType: 'PREPARED',
      productId: null,
      preparedProductId: prepared.id,
      quantity: 1
    });
  }

  addItemToTable(item: any) {
    if (!this.selectedTable) return;

    const token = this.getToken();

    this.http.post<any>(
      `https://bodega-backend-9c4f.onrender.com/tables/${this.selectedTable.id}/items`,
      item,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    ).subscribe({
      next: (res) => {
        this.refreshCurrentOrder();

        this.loadTables();

        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error('Error agregando item:', err);
      }
    });
  }

  increaseItem(item: any) {

    if (item.itemType === 'PRODUCT') {
      const product = this.products.find(
        p => p.id === item.productId
      );

      if (product && item.quantity >= product.stock) {
        alert('No hay más stock disponible');
        return;
      }
    }

    if (item.itemType === 'PREPARED') {
      const prepared = this.preparedProducts.find(
        p => p.id === item.preparedProductId
      );

      const maxServings =
        prepared?.baseProduct?.stock * prepared?.servingsPerUnit;

      if (prepared && item.quantity >= maxServings) {
        alert('No hay más stock disponible para este preparado');
        return;
      }
    }

    this.updateItemQuantity(
      item,
      item.quantity + 1
    );
  }

  decreaseItem(item: any) {
    this.updateItemQuantity(
      item,
      item.quantity - 1
    );
  }

  updateItemQuantity(item: any, quantity: number) {
    const token = this.getToken();

    this.http.put<any>(
      `https://bodega-backend-9c4f.onrender.com/tables/items/${item.id}/quantity?quantity=${quantity}`,
      {},
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    ).subscribe({
      next: (res) => {
        this.selectedOrder = {
          ...res,
          items: [...(res.items || [])]
        };

        this.loadTables();

        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error('Error actualizando cantidad:', err);
      }
    });
  }

  removeItem(itemId: number) {
    const token = this.getToken();

    this.http.delete(
      `https://bodega-backend-9c4f.onrender.com/tables/items/${itemId}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    ).subscribe({
      next: () => {
        if (this.selectedTable){
          this.refreshCurrentOrder();
        }
        this.loadTables();
        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error('Error eliminando item:', err);
      }
    });
  }

  deleteTable(tableId: number, event: Event) {
    event.stopPropagation();

    if (!confirm('¿Eliminar esta mesa?')) return;

    const token = this.getToken();

    this.http.delete(
      `https://bodega-backend-9c4f.onrender.com/tables/${tableId}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    ).subscribe({
      next: () => {
        this.loadTables();
        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error('Error eliminando mesa:', err);
      }
    });
  }

  updateTableName() {
    if (!this.selectedTable) return;

    const token = this.getToken();

    this.http.put<any>(
      `https://bodega-backend-9c4f.onrender.com/tables/${this.selectedTable.id}`,
      {
        name: this.selectedTable.name
      },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    ).subscribe({
      next: (res) => {
        this.selectedTable = res;

        this.loadTables();

        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error('Error actualizando nombre:', err);
      }
    });
  }

  addPayment() {
    this.payments.push({
      method: 'TRANSFER',
      amount: 0
    });

    this.cdRef.detectChanges();
  }

  removePayment(index: number) {
    if (this.payments.length === 1) return;

    this.payments.splice(index, 1);

    this.cdRef.detectChanges();
  }

  getPaymentsTotal() {
    return this.payments.reduce(
      (acc, p) => acc + Number(p.amount),
      0
    );
  }

  paymentsMatch() {
    return Math.abs(
      this.getPaymentsTotal() - this.getOrderTotal()
    ) <= 0.01;
  }

  closeTable() {
    if (!this.selectedTable) return;

    if (!this.selectedOrder?.items?.length) return;

    if (!this.paymentsMatch()) return;

    const token = this.getToken();

    this.http.post(
      `https://bodega-backend-9c4f.onrender.com/tables/${this.selectedTable.id}/close`,
      {
        payments: this.payments
      },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    ).subscribe({
      next: () => {
        this.selectedTable = null;
        this.selectedOrder = null;
        this.search = '';

        this.payments = [
          {
            method: 'CASH',
            amount: 0
          }
        ];

        this.loadTables();
        this.loadProducts();
        this.loadPreparedProducts();

        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error('Error cerrando mesa:', err);
      }
    });
  }

  closeModal() {
    this.selectedTable = null;
    this.selectedOrder = null;
    this.search = '';

    this.payments = [
      {
        method: 'CASH',
        amount: 0
      }
    ];

    this.loadTables();

    this.cdRef.detectChanges();
  }

  get filteredProducts() {
    return this.products.filter(p =>
      p.name.toLowerCase()
        .includes(this.search.toLowerCase())
    );
  }

  get filteredPreparedProducts() {
    return this.preparedProducts.filter(p =>
      p.name.toLowerCase()
        .includes(this.search.toLowerCase())
    );
  }

  getOrderTotal() {
    if (!this.selectedOrder?.items) {
      return 0;
    }

    return this.selectedOrder.items.reduce(
      (acc: number, item: any) =>
        acc + item.price * item.quantity,
      0
    );
  }
}