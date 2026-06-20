import { Component, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { CompanyService } from '../../services/company.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './settings.html',
  styleUrl: './settings.css'
})
export class Settings {

  defaultLogo = 'assets/logo-default.png';
  companyName = '';
  logoUrl = this.defaultLogo;

  constructor(
    private http: HttpClient,
    private companyService: CompanyService,
    private toastr: ToastrService,
    private cdRef: ChangeDetectorRef
  ) {

    const company = this.companyService.getCompany();

    if (company) {
      this.companyName = company.name;
      this.logoUrl = company.logo || this.defaultLogo;
    }
  }

  saveSettings() {

    this.http.put<any>(
      'https://bodega-backend-9c4f.onrender.com/companies/update',
      {
        name: this.companyName
      }

    ).subscribe((res) => {

      this.companyService.setCompany(res);

      this.toastr.success(
        'Configuración guardada'
      );
      this.cdRef.detectChanges();
    });
  }

  onFileSelected(event: any) {

    const file = event.target.files[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      this.logoUrl = reader.result as string;
    };

    reader.readAsDataURL(file);
  }

  onLogoError() {
    this.logoUrl = this.defaultLogo;
  }

  upload() {
    if (!this.logoUrl){
      this.logoUrl = this.defaultLogo;
    }
    
    this.http.post<any>(
      'https://bodega-backend-9c4f.onrender.com/companies/logo',
      {
        logo: this.logoUrl
      }

    ).subscribe((res) => {

      this.companyService.setCompany(res);

      this.toastr.success(
        'Logo actualizado'
      );
      this.cdRef.detectChanges();
    });
  }
}