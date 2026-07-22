import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { PreparedProductsService } from '../../prepared-products.service';
import { ProductsService } from '../../products.service';

const API_URL = 'https://bodega-backend-9c4f.onrender.com';
// TODO: mover a environment.ts, mismo comentario que en los demás componentes

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

  // NUEVO: flags de carga para evitar doble submit
  saving = false;
  deletingId: number | null = null;

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
    private toastr: ToastrService,
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

  getHeaders() {
    return { Authorization: `Bearer ${this.getToken()}` };
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
        this.toastr.error(this.getErrorMessage(err, 'No se pudieron cargar los preparados'));
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
        this.toastr.error(this.getErrorMessage(err, 'No se pudieron cargar los productos'));
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
      this.toastr.error('El nombre es obligatorio');
      return;
    }

    if (this.form.price < 0) {
      this.toastr.error('El precio no puede ser negativo');
      return;
    }

    if (this.form.ingredients.some(i => !i.productId || i.quantity <= 0)) {
      this.toastr.error('Todos los ingredientes deben tener producto y vasos que rinde mayor a cero');
      return;
    }

    if (this.saving) return;

    if (this.editingId) {
      this.updatePreparedProduct();
    } else {
      this.createPreparedProduct();
    }
  }

  createPreparedProduct() {
    this.saving = true;

    this.http.post(
      `${API_URL}/prepared-products`,
      this.getPayload(),
      { headers: this.getHeaders() }
    ).subscribe({
      next: () => {
        this.saving = false;
        this.toastr.success('Preparado creado correctamente');
        this.resetForm();
        this.preparedProductsService.invalidateCache();
        this.loadPreparedProducts();
        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error('Error creando preparado:', err);
        this.saving = false;
        this.toastr.error(this.getErrorMessage(err, 'No se pudo crear el preparado'));
        this.cdRef.detectChanges();
      }
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

    this.saving = true;

    this.http.put(
      `${API_URL}/prepared-products/${this.editingId}`,
      this.getPayload(),
      { headers: this.getHeaders() }
    ).subscribe({
      next: () => {
        this.saving = false;
        this.toastr.info('Preparado actualizado');
        this.resetForm();
        this.preparedProductsService.invalidateCache();
        this.loadPreparedProducts();
        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error('Error actualizando preparado:', err);
        this.saving = false;
        this.toastr.error(this.getErrorMessage(err, 'No se pudo actualizar el preparado'));
        this.cdRef.detectChanges();
      }
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

    if (this.deletingId === id) return;
    this.deletingId = id;

    this.http.delete(
      `${API_URL}/prepared-products/${id}`,
      { headers: this.getHeaders() }
    ).subscribe({
      next: () => {
        this.deletingId = null;
        this.toastr.success('Preparado eliminado');

        if (this.editingId === id) {
          this.resetForm();
        }
        this.preparedProductsService.invalidateCache();
        this.loadPreparedProducts();
        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error('Error eliminando preparado:', err);
        this.deletingId = null;
        this.toastr.error(this.getErrorMessage(err, 'No se pudo eliminar el preparado'));
        this.cdRef.detectChanges();
      }
    });
  }

  getIngredientText(prepared: any) {
    if (!prepared.ingredients || prepared.ingredients.length === 0) {
      return 'Sin ingredientes';
    }

    return prepared.ingredients
      .map((i: any) => {
        const vasos = i.quantity ? 1 / i.quantity : 0;
        const vasosRedondeado = vasos.toFixed(0);
        // Corrección menor de concordancia: "1 vaso" en singular, "2 vasos" en plural
        const palabra = Number(vasosRedondeado) === 1 ? 'vaso' : 'vasos';
        return `${i.product?.name} - rinde ${vasosRedondeado} ${palabra}`;
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