import { Component, OnInit, ChangeDetectorRef} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterModule} from '@angular/router';
import { filter } from 'rxjs';
import { ToastrService } from 'ngx-toastr';

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

  constructor(
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private toastr: ToastrService
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

  load(search: string = '', categoryId: number | null = null) {
    let url = `${this.apiUrl}/products`;
    const params: string[] = [];

    if (search) params.push(`search=${encodeURIComponent(search)}`);
    if (categoryId) params.push(`categoryId=${categoryId}`);
    if (params.length) url += '?' + params.join('&');

    this.loadingProducts = true;
    this.cdr.detectChanges();

    this.http.get<any[]>(url).subscribe({
      next: (res) => {
        this.products = res;
        this.loadingProducts = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error fetching products:', err);
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
    this.http.get<any[]>(`${this.apiUrl}/categories`)
      .subscribe(res => {
        this.categories = res;
        this.cdr.detectChanges();
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

    this.http.post(`${this.apiUrl}/products`, {
      name: this.name,
      price: this.price,
      stock: this.stock,
      categoryId: this.selectedCategoryId
    }).subscribe(() => {
      this.toastr.success('Producto creado correctamente');
      this.createAttempted = false;
      this.name = '';
      this.price = null;
      this.stock = null;
      this.selectedCategoryId = null;
      this.showCreateProductModal = false;
      this.load();
    });
  }

  delete(id: number) {
    if (!confirm('¿Estás seguro de eliminar este producto?')) return;

    this.http.delete(`${this.apiUrl}/products/${id}`)
      .subscribe(() => {
        this.toastr.error('Producto eliminado');
        this.load();
      });
  }

  openEdit(p: any) {
    this.editingProduct = {
      ...p,
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
    this.http.put(
      `${this.apiUrl}/categories/${this.editingCategory.id}`,
      { name: this.editingCategoryName }
    ).subscribe(() => {
      this.toastr.info('Categoría actualizada');

      this.editingCategory = null;
      this.editingCategoryName = '';

      this.loadCategories();
    });
  }

  deleteCategory(id: number) {
    if (!confirm('¿Eliminar categoría?')) return;

    this.http.delete(`${this.apiUrl}/categories/${id}`)
      .subscribe(() => {
        this.toastr.error('Categoría eliminada');

        this.loadCategories();
        this.load();
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

    this.http.put(`${this.apiUrl}/products/${this.editingProduct.id}`, {
      name: this.editingProduct.name,
      price: this.editingProduct.price,
      stock: this.editingProduct.stock,
      categoryId: this.editingProduct.categoryId
    }).subscribe(() => {
      this.toastr.info('Producto actualizado');
      this.editAttempted = false;
      this.editingProduct = null;
      this.load();
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
    if (!this.newCategory.trim()) return;

    this.http.post(`${this.apiUrl}/categories`, {
      name: this.newCategory
    }).subscribe(() => {
      this.toastr.success('Categoría creada');

      this.newCategory = '';

      this.loadCategories();
    });
  }

  toNumber(value: any): number {
    return Number(value);
  }
}