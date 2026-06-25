import { Component } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
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
    private companyService: CompanyService
  ) {
    this.companyService.rehydrate();
  }

  logout() {
    localStorage.removeItem('token');
    this.router.navigate(['/login']);
  }

  isLogin() {
    return this.router.url === '/login';
  }
}