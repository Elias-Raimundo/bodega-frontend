import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class Register {

  email: string = '';
  password: string = '';
  companyName: string = '';
  confirmPassword: string = '';

  showPassword = false;
  showConfirmPassword = false;

  loading = false;

  constructor(private http: HttpClient, private router: Router, private toastr: ToastrService) {}

  register() {
    if (this.password !== this.confirmPassword) {
      this.toastr.error('Las contraseñas no coinciden');
      return;
    }
    this.loading = true;
    this.http.post('https://bodega-backend-9c4f.onrender.com/auth/register', {
      email: this.email,
      password: this.password,
      companyName: this.companyName
    }).subscribe({
      next: (res: any) => {
        console.log ('REGISTER RESPONSE: ', res);

        if (res.token) {
          localStorage.setItem('token', res.token);
          this.toastr.success(
            'Cuenta creada correctamente'
          );
          this.loading = false;
          this.router.navigate(['/dashboard']);
        }else{
          this.toastr.error(res.error || 'Error al registrar');
          this.loading = false;
        }
      },
      error: () => {
        this.toastr.error('Error al registrar');
        this.loading = false;
      }
    });
  }
}