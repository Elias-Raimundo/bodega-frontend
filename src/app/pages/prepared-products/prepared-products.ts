import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'app-prepared-products',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './prepared-products.html',
  styleUrl: './prepared-products.css'
})
export class PreparedProducts implements OnInit {

  preparedProducts: any[] = [];
  products: any[] = [];

  editingId: number | null = null;

  form = {
    name: '',
    price: 0,
    servingsPerUnit: 1,
    baseProductId: null as number | null
  };

  constructor(
    private http: HttpClient,
    private cdRef: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadPreparedProducts();
    this.loadProducts();
  }

  getToken() {
    return localStorage.getItem('token');
  }

  loadPreparedProducts() {
    const token = this.getToken();

    this.http.get<any[]>(
      'https://bodega-backend-9c4f.onrender.com/prepared-products',
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    ).subscribe(res => {
      this.preparedProducts = res;
      this.cdRef.detectChanges();
    });
  }

  loadProducts() {
    const token = this.getToken();

    this.http.get<any[]>(
      'https://bodega-backend-9c4f.onrender.com/products',
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    ).subscribe(res => {
      this.products = res;
      this.cdRef.detectChanges();
    });
  }

  savePreparedProduct() {
    if (this.editingId) {
      this.updatePreparedProduct();
    } else {
      this.createPreparedProduct();
    }
  }

  createPreparedProduct() {
    const token = this.getToken();

    this.http.post(
      'https://bodega-backend-9c4f.onrender.com/prepared-products',
      this.form,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    ).subscribe(() => {
      this.resetForm();
      this.loadPreparedProducts();
      this.cdRef.detectChanges();
    });
  }

  editPreparedProduct(prepared: any) {
    this.editingId = prepared.id;

    this.form = {
      name: prepared.name,
      price: prepared.price,
      servingsPerUnit: prepared.servingsPerUnit,
      baseProductId: prepared.baseProduct?.id || null
    };

    this.cdRef.detectChanges();
  }

  updatePreparedProduct() {
    if (!this.editingId) return;

    const token = this.getToken();

    this.http.put(
      `https://bodega-backend-9c4f.onrender.com/prepared-products/${this.editingId}`,
      this.form,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    ).subscribe(() => {
      this.resetForm();
      this.loadPreparedProducts();
      this.cdRef.detectChanges();
    });
  }

  cancelEdit() {
    this.resetForm();
    this.cdRef.detectChanges();
  }

  resetForm() {
    this.editingId = null;

    this.form = {
      name: '',
      price: 0,
      servingsPerUnit: 1,
      baseProductId: null
    };
  }

  deletePreparedProduct(id: number) {
    if (!confirm('¿Eliminar este preparado?')) return;

    const token = this.getToken();

    this.http.delete(
      `https://bodega-backend-9c4f.onrender.com/prepared-products/${id}`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    ).subscribe(() => {
      if (this.editingId === id) {
        this.resetForm();
      }

      this.loadPreparedProducts();
      this.cdRef.detectChanges();
    });
  }
}