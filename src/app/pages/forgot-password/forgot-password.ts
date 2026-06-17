import { ChangeDetectorRef, Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.css'
})
export class ForgotPassword {

  email = '';
  code = '';
  newPassword = '';
  confirmPassword = '';

  step = 1;
  loading = false;

  showPassword = false;
  showConfirmPassword = false;

  constructor(
    private http: HttpClient,
    private toastr: ToastrService,
    private cdRef: ChangeDetectorRef
  ) {}

  sendCode() {
    if (!this.email.trim()) {
      this.toastr.error('Ingresá tu email');
      return;
    }

    this.loading = true;
    this.cdRef.detectChanges();

    this.http.post(
      'https://bodega-backend-9c4f.onrender.com/auth/forgot-password',
      { email: this.email }
    ).subscribe({
      next: (res: any) => {
        this.loading = false;

        if (res.error) {
          this.toastr.error(res.error);
          this.cdRef.detectChanges();
          return;
        }

        this.toastr.success('Código enviado. Revisá tu email');
        this.step = 2;

        this.cdRef.detectChanges();
      },

      error: (err) => {
        this.loading = false;

        this.toastr.error(
          err?.error?.error || 'Error enviando código'
        );

        this.cdRef.detectChanges();
      },

      complete: () => {
        this.loading = false;
        this.cdRef.detectChanges();
      }
    });
  }

  reset() {
    if (!this.code.trim()) {
      this.toastr.error('Ingresá el código');
      return;
    }

    if (!this.newPassword.trim()) {
      this.toastr.error('Ingresá la nueva contraseña');
      return;
    }

    if (!this.confirmPassword.trim()) {
      this.toastr.error('Confirmá la nueva contraseña');
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.toastr.error('Las contraseñas no coinciden');
      return;
    }

    this.loading = true;
    this.cdRef.detectChanges();

    this.http.post(
      'https://bodega-backend-9c4f.onrender.com/auth/reset-password',
      {
        email: this.email,
        code: this.code,
        newPassword: this.newPassword
      }
    ).subscribe({
      next: (res: any) => {
        this.loading = false;

        if (res.error) {
          this.toastr.error(res.error);
          this.cdRef.detectChanges();
          return;
        }

        this.toastr.success('Contraseña actualizada correctamente');

        this.code = '';
        this.newPassword = '';
        this.confirmPassword = '';
        this.step = 1;

        this.cdRef.detectChanges();
      },

      error: (err) => {
        this.loading = false;

        this.toastr.error(
          err?.error?.error || 'Error cambiando contraseña'
        );

        this.cdRef.detectChanges();
      },

      complete: () => {
        this.loading = false;
        this.cdRef.detectChanges();
      }
    });
  }

  backToEmail() {
    this.step = 1;
    this.code = '';
    this.newPassword = '';
    this.confirmPassword = '';

    this.cdRef.detectChanges();
  }
}