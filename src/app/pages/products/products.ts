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
export class Products  implements OnInit {

  products: any[] = [];

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

  constructor(private http: HttpClient, private router:Router, private cdr: ChangeDetectorRef, private toastr: ToastrService) {}

  ngOnInit() {
    this.load();
    this.loadCategories();

    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => { 
        this.load(); 
      });
  }
  
  load() {
    console.log('Cargando productos...');
    this.http.get<any[]>('https://bodega-backend-9c4f.onrender.com/products')
      .subscribe(res => {
        console.log('Productos cargados:', res);
        this.products = res;

        this.cdr.detectChanges();
      });
  }

  loadCategories() {
    this.http.get<any[]>('https://bodega-backend-9c4f.onrender.com/categories')
      .subscribe(res => {
        this.categories = res;
        this.cdr.detectChanges();
      });
  }

  create() {
    if ((this.stock ?? 0) < 0){
      this.toastr.error('El stock no puede ser negativo');
      return;
    }
    this.http.post('https://bodega-backend-9c4f.onrender.com/products', {
      name: this.name,
      price: this.price,
      stock: this.stock,
      categoryId: this.selectedCategoryId 
    }).subscribe(() => {

      this.toastr.success(
        'Producto creado correctamente'
      );

      this.name = '';
      this.price = null;
      this.stock = null;
      this.selectedCategoryId = null;

      this.load();
    });
  };


  delete(id: number) {
    if (!confirm('¿Estás seguro de eliminar este producto?')) return;
    this.http.delete(`https://bodega-backend-9c4f.onrender.com/products/${id}`)
      .subscribe(() => {

      this.toastr.error(
        'Producto eliminado'
      );

      this.load();
    });
  };

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
      `https://bodega-backend-9c4f.onrender.com/categories/${this.editingCategory.id}`,
      {
        name: this.editingCategoryName
      }
    ).subscribe(() => {

      this.toastr.info(
        'Categoría actualizada'
      );

      this.editingCategory = null;
      this.editingCategoryName = '';

      this.loadCategories();
    });
  }

  deleteCategory(id: number) {

    if (!confirm('¿Eliminar categoría?')) return;

    this.http.delete(`https://bodega-backend-9c4f.onrender.com/categories/${id}`)
      .subscribe(() => {

        this.toastr.error(
          'Categoría eliminada'
        );

        this.loadCategories();
        this.load();

      });
  }

  update() {
    if ((this.editingProduct.stock ?? 0) < 0){
      this.toastr.error('El stock no puede ser negativo');
      return;
    }
    this.http.put(`https://bodega-backend-9c4f.onrender.com/products/${this.editingProduct.id}`,{
      name: this.editingProduct.name,
      price: this.editingProduct.price,
      stock: this.editingProduct.stock,
      categoryId: this.editingProduct.categoryId
    })
      .subscribe(() => {

        this.toastr.info(
          'Producto actualizado'
        );

        this.editingProduct = null;

        this.load();
      });
  };

  filteredProducts() {

    let filtered = this.products.filter(p => {

      const matchSearch =
        p.name.toLowerCase()
          .includes(this.search.toLowerCase());

      const matchCategory =
        this.selectedFilterCategoryId === null ||
        p.category?.id === this.selectedFilterCategoryId;

      let matchStock = true;

      if (this.stockFilter === 'low') {
        matchStock = p.stock > 0 && p.stock <= 5;
      }

      if (this.stockFilter === 'empty') {
        matchStock = p.stock === 0;
      }

      return matchSearch && matchCategory && matchStock;
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
    this.http.post('https://bodega-backend-9c4f.onrender.com/categories', {
      name: this.newCategory
    }).subscribe(() => {

      this.toastr.success(
        'Categoría creada'
      );

      this.newCategory = '';

      this.loadCategories();
    });
  }
  
  toNumber(value: any): number {
    return Number(value);
  }
}
