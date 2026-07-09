import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef } from '@angular/core';
import { PreparedProductsService } from '../../prepared-products.service';
import { ProductsService } from '../../products.service';

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

  search = '';

  editingId: number | null = null;

  loadingProducts = false;
  loadingPrepared = false;

  form = {
    name: '',
    price: 0,
    ingredients: [
      {
        productId: null as number | null,
        quantity: 1,
        search: ''
      }
    ]
  };

  constructor(
    private http: HttpClient,
    private cdRef: ChangeDetectorRef,
    private preparedProductsService: PreparedProductsService,
    private productsService: ProductsService
  ) {}

  ngOnInit() {
    this.loadPreparedProducts();
    this.loadProducts();
  }

  getToken() {
    return localStorage.getItem('token');
  }

  getPayload() {
    return {
      name: this.form.name,
      price: this.form.price,
      ingredients: this.form.ingredients.map(i => ({
        productId: i.productId,
        quantity: 1 / Number(i.quantity)
      }))
    };
  }

  loadPreparedProducts(forceRefresh = false) {
    this.loadingPrepared = true;
    this.cdRef.detectChanges();

    this.preparedProductsService.getPreparedProducts(forceRefresh).subscribe({
      next: (res) => {
        this.preparedProducts = res;
        this.loadingPrepared = false;
        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error(err);
        this.loadingPrepared = false;
        this.cdRef.detectChanges();
      }
    });
  }

  loadProducts() {
    this.loadingProducts = true;
    this.cdRef.detectChanges();

    this.productsService.getProducts().subscribe({
      next: (res) => {
        this.products = res;
        this.loadingProducts = false;
        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error(err);
        this.loadingProducts = false;
        this.cdRef.detectChanges();
      }
    });
  }

  get filteredPreparedProducts() {
    return this.preparedProducts.filter(p =>
      p.name?.toLowerCase()
        .includes(this.search.toLowerCase())
    );
  }

  addIngredient() {
    this.form.ingredients.push({
      productId: null,
      quantity: 1,
      search: ''
    } as any);
  }

  removeIngredient(index: number) {
    if (this.form.ingredients.length === 1) return;
    this.form.ingredients.splice(index, 1);
  }

  savePreparedProduct() {
    if (!this.form.name.trim()) {
      alert('El nombre es obligatorio');
      return;
    }

    if (this.form.price < 0) {
      alert('El precio no puede ser negativo');
      return;
    }

    if (this.form.ingredients.some(i => !i.productId || i.quantity <= 0)) {
      alert('Todos los ingredientes deben tener producto y vasos que rinde mayor a cero');
      return;
    }

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
      this.getPayload(),
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    ).subscribe(() => {
      this.resetForm();
      this.preparedProductsService.invalidateCache();
      this.loadPreparedProducts();
      this.cdRef.detectChanges();
    });
  }

  editPreparedProduct(prepared: any) {
    this.editingId = prepared.id;

    this.form = {
      name: prepared.name,
      price: prepared.price,
      ingredients: prepared.ingredients?.map((i: any) => ({
        productId: i.product?.id || null,
        quantity: i.quantity ? 1 / i.quantity : 1,
        search: i.product?.name || ''
      })) || [
        {
          productId: null,
          quantity: 1,
          search: ''
        }
      ]
    };

    this.cdRef.detectChanges();
  }

  updatePreparedProduct() {
    if (!this.editingId) return;

    const token = this.getToken();

    this.http.put(
      `https://bodega-backend-9c4f.onrender.com/prepared-products/${this.editingId}`,
      this.getPayload(),
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    ).subscribe(() => {
      this.resetForm();
      this.preparedProductsService.invalidateCache();
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
      ingredients: [
        {
          productId: null,
          quantity: 1,
          search: ''
        }
      ]
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
      this.preparedProductsService.invalidateCache();
      this.loadPreparedProducts();
      this.cdRef.detectChanges();
    });
  }

  getIngredientText(prepared: any) {
    if (!prepared.ingredients || prepared.ingredients.length === 0) {
      return 'Sin ingredientes';
    }

    return prepared.ingredients
      .map((i: any) => {
        const vasos = i.quantity ? 1 / i.quantity : 0;
        return `${i.product?.name} - rinde ${vasos.toFixed(0)} vasos`;
      })
      .join(' + ');
  }

  filteredIngredientProducts(ingredient: any) {
    const term = (ingredient.search || '').trim().toLowerCase();
    if (!term) return [];
    return this.products.filter(p =>
      p.name?.toLowerCase().includes(term)
    );
  }

  selectIngredientProduct(ingredient: any, product: any) {
    ingredient.productId = product.id;
    ingredient.search = product.name;
  }
}