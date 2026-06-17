import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CompanyService } from '../../services/company.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {

  email: string = '';
  password: string = '';
  showPassword = false;

  loading = false;

  constructor(private http: HttpClient, private router: Router, private companyService: CompanyService, private toastr: ToastrService) {}

  login() {
    this.loading = true;
    this.http.post('https://bodega-backend-9c4f.onrender.com/auth/login', {
      email: this.email,
      password: this.password
    }).subscribe({
      next: (res: any) => {
        if (res.error){
          this.toastr.error(res.error);
          this.loading = false;
          return;
        }
        localStorage.setItem('token', res.token);
        this.http.get('https://bodega-backend-9c4f.onrender.com/companies/me')
          .subscribe({

            next: (company) => {

              this.companyService.setCompany(company);

              this.toastr.success('Bienvenido');
              this.loading = false;
              this.router.navigate(['/dashboard']);
            },

            error: () => {
              this.loading = false;
              this.toastr.error(
                'Error cargando empresa'
              );
            }
          });
      },
    error: () => {
      this.toastr.error('Error en login');
      this.loading = false;
    }
    });
  }
}
