import { Component } from '@angular/core';
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

  companyName = '';
  logoUrl = '';

  constructor(
    private http: HttpClient,
    private companyService: CompanyService,
    private toastr: ToastrService
  ) {

    const company = this.companyService.getCompany();

    if (company) {
      this.companyName = company.name;
      this.logoUrl = company.logo;
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

  upload() {

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
    });
  }
}