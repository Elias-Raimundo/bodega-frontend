import { Component, OnInit, ChangeDetectorRef} from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterModule} from '@angular/router';
import { filter } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { ProductsService } from '../../products.service';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './products.html',
  styleUrl: './products.css'
})
export class Products implements OnInit {

  private apiUrl = 'https://bodega-backend-9c4f.onrender.com';

  products: any[] = [];
  createAttempted = false;
  editAttempted = false;
  name = '';
  price: number | null = null;
  stock: number | null = null;

  categories: any[] = [];
  newCategory = '';
  selectedCategoryId: number | null = null;

  selectedFilterCategoryId: number | null = null;

  search = '';

  editingProduct: any = null;

  editingCategory: any = null;
  editingCategoryName = '';

  sortBy = 'name';

  showCreateProductModal = false;
  showCategoriesModal = false;
  stockFilter = 'all';

  searchTimeout: any = null;

  loadingProducts = false;

  selectedImportFile: File | null = null;
  importing = false;

  // NUEVO: flags de carga para evitar doble submit en crear/editar/eliminar
  creatingProduct = false;
  updatingProduct = false;
  deletingProductId: number | null = null;
  creatingCategory = false;
  updatingCategory = false;
  deletingCategoryId: number | null = null;

  constructor(
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private toastr: ToastrService,
    private productsService: ProductsService
  ) {}

  ngOnInit() {
    this.load();
    this.loadCategories();

    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.load();
      });
  }

  // Mismo helper que en sales.ts / tables.ts
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
    if (err.error?.error) {
      return err.error.error;
    }
    if (err.status === 401) {
      return 'Tu sesión expiró. Iniciá sesión de nuevo.';
    }
    return fallback;
  }

  load(search: string = '', categoryId: number | null = null, forceRefresh = false) {
    this.loadingProducts = true;
    this.cdr.detectChanges();

    this.productsService.getProducts(search, categoryId, forceRefresh).subscribe({
      next: (res) => {
        this.products = res;
        this.loadingProducts = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error fetching products:', err);
        this.toastr.error(this.getErrorMessage(err, 'No se pudieron cargar los productos'));
        this.loadingProducts = false;
        this.cdr.detectChanges();
      }
    });
  }

  onSearchChange() {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.load(this.search, this.selectedFilterCategoryId);
    }, 300);
  }

  onCategoryChange() {
    this.load(this.search, this.selectedFilterCategoryId);
  }

  loadCategories() {

    this.http.get<any[]>(`${this.apiUrl}/categories`).subscribe({
      next: (res) => {
        this.categories = res;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error cargando categorías:', err);
        this.toastr.error(this.getErrorMessage(err, 'No se pudieron cargar las categorías'));
      }
    });
  }

  create() {
    this.createAttempted = true;

    if (!this.name.trim()) {
      this.toastr.error('El nombre es obligatorio');
      return;
    }

    if (this.price === null || this.price < 0) {
      this.toastr.error('El precio no puede ser negativo');
      return;
    }

    if (this.stock === null || this.stock < 0) {
      this.toastr.error('El stock no puede ser negativo');
      return;
    }

    if (this.creatingProduct) return;
    this.creatingProduct = true;

    this.http.post(`${this.apiUrl}/products`, {
      name: this.name,
      price: this.price,
      stock: this.stock,
      categoryId: this.selectedCategoryId
    }).subscribe({
      next: () => {
        this.creatingProduct = false;
        this.toastr.success('Producto creado correctamente');
        this.createAttempted = false;
        this.name = '';
        this.price = null;
        this.stock = null;
        this.selectedCategoryId = null;
        this.showCreateProductModal = false;
        this.productsService.invalidateCache();
        this.load();
      },
      error: (err) => {
        console.error('Error creando producto:', err);
        this.creatingProduct = false;
        this.toastr.error(this.getErrorMessage(err, 'No se pudo crear el producto'));
      }
    });
  }

  delete(id: number) {
    if (!confirm('¿Estás seguro de eliminar este producto?')) return;

    if (this.deletingProductId === id) return;
    this.deletingProductId = id;

    this.http.delete(`${this.apiUrl}/products/${id}`).subscribe({
      next: () => {
        this.deletingProductId = null;
        // ANTES: toastr.error() para una eliminación exitosa — el rojo
        // confunde, parece que algo salió mal cuando en realidad se borró bien.
        this.toastr.success('Producto eliminado');
        this.productsService.invalidateCache();
        this.load();
      },
      error: (err) => {
        console.error('Error eliminando producto:', err);
        this.deletingProductId = null;
        this.toastr.error(this.getErrorMessage(err, 'No se pudo eliminar el producto'));
      }
    });
  }

  openEdit(p: any) {
    this.editingProduct = {
      ...p,
      stock: Math.floor(p.stock),
      categoryId: p.category?.id
        ? Number(p.category.id)
        : p.categoryId
          ? Number(p.categoryId)
          : null
    };

    this.cdr.detectChanges();
  }

  openCategoryEdit(category: any) {
    this.editingCategory = category;
    this.editingCategoryName = category.name;
    this.cdr.detectChanges();
  }

  updateCategory() {
    if (!this.editingCategoryName.trim()) {
      this.toastr.error('El nombre de la categoría es obligatorio');
      return;
    }

    if (this.updatingCategory) return;
    this.updatingCategory = true;

    this.http.put(
      `${this.apiUrl}/categories/${this.editingCategory.id}`,
      { name: this.editingCategoryName }
    ).subscribe({
      next: () => {
        this.updatingCategory = false;
        this.toastr.info('Categoría actualizada');

        this.editingCategory = null;
        this.editingCategoryName = '';
        this.productsService.invalidateCache();

        this.loadCategories();
        this.load();
      },
      error: (err) => {
        console.error('Error actualizando categoría:', err);
        this.updatingCategory = false;
        this.toastr.error(this.getErrorMessage(err, 'No se pudo actualizar la categoría'));
      }
    });
  }

  deleteCategory(id: number) {
    if (!confirm('¿Eliminar categoría?')) return;

    if (this.deletingCategoryId === id) return;
    this.deletingCategoryId = id;

    this.http.delete(`${this.apiUrl}/categories/${id}`).subscribe({
      next: () => {
        this.deletingCategoryId = null;
        // Mismo fix de color que en delete() de productos
        this.toastr.success('Categoría eliminada');

        this.productsService.invalidateCache();
        this.loadCategories();
        this.load();
      },
      error: (err) => {
        console.error('Error eliminando categoría:', err);
        this.deletingCategoryId = null;
        this.toastr.error(this.getErrorMessage(err, 'No se pudo eliminar la categoría'));
      }
    });
  }

  update() {
    this.editAttempted = true;

    if (!this.editingProduct.name?.trim()) {
      this.toastr.error('El nombre es obligatorio');
      return;
    }

    if (this.editingProduct.price === null || this.editingProduct.price < 0) {
      this.toastr.error('El precio no puede ser negativo');
      return;
    }

    if (this.editingProduct.stock === null || this.editingProduct.stock < 0) {
      this.toastr.error('El stock no puede ser negativo');
      return;
    }

    if (this.updatingProduct) return;
    this.updatingProduct = true;

    this.http.put(`${this.apiUrl}/products/${this.editingProduct.id}`, {
      name: this.editingProduct.name,
      price: this.editingProduct.price,
      stock: this.editingProduct.stock,
      categoryId: this.editingProduct.categoryId
    }).subscribe({
      next: () => {
        this.updatingProduct = false;
        this.toastr.info('Producto actualizado');
        this.editAttempted = false;
        this.editingProduct = null;
        this.productsService.invalidateCache();
        this.load();
      },
      error: (err) => {
        console.error('Error actualizando producto:', err);
        this.updatingProduct = false;
        this.toastr.error(this.getErrorMessage(err, 'No se pudo actualizar el producto'));
      }
    });
  }

  onImportFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;

    if (!input.files || input.files.length === 0) {
      this.selectedImportFile = null;
      return;
    }

    const file = input.files[0];

    if (!file.name.toLowerCase().endsWith('.csv')) {
      this.toastr.error('El archivo debe ser CSV');
      this.selectedImportFile = null;
      input.value = '';
      return;
    }

    this.selectedImportFile = file;
  }

  importProducts() {
    if (!this.selectedImportFile) {
      this.toastr.error('Seleccioná un archivo CSV');
      return;
    }

    if (this.importing) return;

    const formData = new FormData();
    formData.append('file', this.selectedImportFile);

    this.importing = true;

    this.http.post(
      `${this.apiUrl}/products/import`,
      formData,
      { responseType: 'text' }
    ).subscribe({
      next: (res: string) => {
        this.toastr.success(res || 'Productos importados correctamente');

        this.selectedImportFile = null;
        this.importing = false;
        this.productsService.invalidateCache();
        this.load();
        this.loadCategories();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.importing = false;

        const msg =
          err?.error?.error ||
          err?.error ||
          'Error importando productos';

        this.toastr.error(msg);
      }
    });
  }

  filteredProducts() {
    let filtered = this.products.filter(p => {

        let matchStock = true;

        if (this.stockFilter === 'low') {
          matchStock = p.stock > 0 && p.stock <= 5;
        }

        if (this.stockFilter === 'empty') {
          matchStock = p.stock === 0;
        }

        return matchStock;
      });
      
    switch(this.sortBy){

      case 'name':
        filtered.sort((a,b) =>
          a.name.localeCompare(b.name)
        );
        break;

      case 'price':
        filtered.sort((a,b) =>
          b.price - a.price
        );
        break;

      case 'stock':
        filtered.sort((a,b) =>
          b.stock - a.stock
        );
        break;

      case 'category':
        filtered.sort((a,b) =>
          (a.category?.name || '')
            .localeCompare(b.category?.name || '')
        );
        break;

      case 'lessStock':
        filtered.sort((a,b) =>
          a.stock - b.stock
        );
        break;
    }

    return filtered;
  }

  createCategory() {
    if (!this.newCategory.trim()) {
      this.toastr.warning('Ingresá un nombre de categoría');
      return;
    }

    if (this.creatingCategory) return;
    this.creatingCategory = true;

    this.http.post(`${this.apiUrl}/categories`, {
      name: this.newCategory
    }).subscribe({
      next: () => {
        this.creatingCategory = false;
        this.toastr.success('Categoría creada');

        this.newCategory = '';

        this.loadCategories();
      },
      error: (err) => {
        console.error('Error creando categoría:', err);
        this.creatingCategory = false;
        this.toastr.error(this.getErrorMessage(err, 'No se pudo crear la categoría'));
      }
    });
  }

  toNumber(value: any): number {
    return Number(value);
  }
}