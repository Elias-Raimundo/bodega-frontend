import { Component, OnInit } from '@angular/core';
import { RouterOutlet, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CompanyService } from '../services/company.service';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef } from '@angular/core';
import { ProductsService } from '../products.service';
import { PreparedProductsService } from '../prepared-products.service';
import { OfflineService, OfflineStatus } from '../offline/offline.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, CommonModule, RouterModule],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.css'
})
export class MainLayout implements OnInit {

  companyName = '';
  logo: string | null = null;
  offlineStatus: OfflineStatus | null = null;

  constructor(
    private http: HttpClient, 
    private router: Router, 
    private companyService: CompanyService,
    private cdRef: ChangeDetectorRef,
    private productsService: ProductsService,
    private preparedProductsService: PreparedProductsService,
    public offline: OfflineService
  ) {}

  ngOnInit() {
    this.offline.start();
    this.offline.status$.subscribe(status => {
      this.offlineStatus = status;
      this.cdRef.detectChanges();
    });

    this.companyService.company$.subscribe(company => {
      if (company) {
        this.logo = company.logo || null;
        this.companyName = company.name;
        this.cdRef.detectChanges();
      }
    });

    if (!this.companyService.getCompany()) {
      const token = localStorage.getItem('token');

      this.http.get<any>('https://bodega-backend-9c4f.onrender.com/companies/me', {
        headers: {
          'Authorization': `Bearer ${token}`
         }
      }).subscribe( res =>{
        this.companyService.setCompany(res);
        this.logo = res.logo || null;
        this.companyName = res.name;
        this.cdRef.detectChanges();
      });
    }
  }
  
  onLogoError() {
    this.logo = null;
  }

  logout() {
    const pending = this.offline.pendingCount();
    if (pending > 0 && !confirm(
      `Hay ${pending} ${pending === 1 ? 'operación' : 'operaciones'} sin sincronizar. ` +
      'Quedan guardadas en esta computadora y se envían cuando vuelvas a entrar con esta cuenta. ¿Cerrar sesión igual?'
    )) {
      return;
    }

    this.companyService.clear();
    this.productsService.invalidateCache(); 
    this.preparedProductsService.invalidateCache();
    this.router.navigate(['/login']);
  }

  menuOpen = false;

  toggleMenu() {
    this.menuOpen = !this.menuOpen;
  }

  closeMenu() {
    this.menuOpen = false;
  }
}