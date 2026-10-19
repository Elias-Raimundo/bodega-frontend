import { Component, Inject, inject } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { ToastrService } from 'ngx-toastr';
import { filter } from 'rxjs';
import { RouterOutlet, Router } from '@angular/router';
import { DOCUMENT } from '@angular/common';
import { CompanyService } from './services/company.service';
import { ProductsService } from './products.service';
import { PreparedProductsService } from './prepared-products.service';

@Component({
  selector: 'app-root',
  standalone: true, 
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  constructor(
    private router: Router,
    private companyService: CompanyService,
    private productsService: ProductsService,
    private preparedProductsService: PreparedProductsService,
    @Inject(DOCUMENT) private document: Document
  ) {
    this.companyService.rehydrate();
    this.watchForUpdates();

    // Cada vez que cambie la company, actualizar el favicon
    this.companyService.company$.subscribe(company => {
      if (company?.logo) {
        this.setFavicon(company.logo);
      }
    });
  }

  setFavicon(logoUrl: string) {
    let link = this.document.querySelector("link[rel='icon']") as HTMLLinkElement;
    if (!link) {
      link = this.document.createElement('link');
      link.rel = 'icon';
      this.document.head.appendChild(link);
    }
    link.type = 'image/png';
    link.href = logoUrl;
  }

  logout() {
    this.companyService.clear();
    this.productsService.invalidateCache();
    this.preparedProductsService.invalidateCache();
    this.router.navigate(['/login']);
  }

  isLogin() {
    return this.router.url === '/login';
  }

  // Con el sistema guardado en la computadora, una versión nueva se activa
  // al recargar. Se avisa en vez de recargar solo, para no cortar una venta.
  private watchForUpdates() {
    const updates = inject(SwUpdate);
    const toastr = inject(ToastrService);

    if (!updates.isEnabled) return;

    updates.versionUpdates
      .pipe(filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'))
      .subscribe(() => {
        toastr.info(
          'Hay una versión nueva del sistema. Recargá la página (F5) cuando termines lo que estás haciendo.',
          'Actualización disponible',
          { disableTimeOut: true, closeButton: true }
        );
      });
  }
}
