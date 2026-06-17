import { Component, OnInit } from '@angular/core';
import { RouterOutlet, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CompanyService } from '../services/company.service';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, CommonModule, RouterModule],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.css'
})
export class MainLayout implements OnInit {
  logo: string | null = null ;

  companyName = '';

  collapsed = false;

  constructor(
    private http: HttpClient, 
    private router: Router, 
    private companyService: CompanyService,
    private cdRef: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.companyService.company$.subscribe(company => {
      if (company) {
        this.logo = company.logo;
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
        this.logo = res.logo;
        this.companyName = res.name;
      });
    }
  }
  

  logout() {
    localStorage.removeItem('token');
    this.router.navigate(['/login']);
  }
}