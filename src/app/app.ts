import { Component, Inject } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { DOCUMENT } from '@angular/common';
import { CompanyService } from './services/company.service';

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
    @Inject(DOCUMENT) private document: Document
  ) {
    this.companyService.rehydrate();

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
    localStorage.removeItem('token');
    this.router.navigate(['/login']);
  }

  isLogin() {
    return this.router.url === '/login';
  }
}