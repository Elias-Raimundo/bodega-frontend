import { Component, ChangeDetectorRef } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { CompanyService } from '../../services/company.service';
import { ToastrService } from 'ngx-toastr';

const API_URL = 'https://bodega-backend-9c4f.onrender.com';
// TODO: mover a environment.ts, mismo comentario que en los demás componentes

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './settings.html',
  styleUrl: './settings.css'
})
export class Settings {

  companyName = '';
  logoUrl: string | null = null;

  // NUEVO: flags de carga para evitar doble submit
  savingSettings = false;
  uploadingLogo = false;

  constructor(
    private http: HttpClient,
    private companyService: CompanyService,
    private toastr: ToastrService,
    private cdRef: ChangeDetectorRef
  ) {

    const company = this.companyService.getCompany();

    if (company) {
      this.companyName = company.name;
      this.logoUrl = company.logo || null;
    }
  }

  getHeaders() {
    const token = localStorage.getItem('token');
    return { Authorization: `Bearer ${token}` };
  }

  // Mismo helper que en el resto de los componentes
  private getErrorMessage(err: HttpErrorResponse, fallback: string): string {
    if (err.status === 0) {
      return 'No se pudo conectar con el servidor. Revisá tu conexión a internet.';
    }
    if (typeof err.error === 'string' && err.error.trim()) {
      return err.error;
    }
    if (err.error?.message) {
      return Array.isArray(err.error.message)
        ? err.error.message.join(', ')
        : err.error.message;
    }
    if (err.status === 401) {
      return 'Tu sesión expiró. Iniciá sesión de nuevo.';
    }
    return fallback;
  }

  saveSettings() {

    if (!this.companyName.trim()) {
      this.toastr.error('El nombre de la empresa es obligatorio');
      return;
    }

    if (this.savingSettings) return;
    this.savingSettings = true;

    this.http.put<any>(
      `${API_URL}/companies/update`,
      {
        name: this.companyName
      },
      // ANTES: faltaba el header de autenticación. Si el backend exige
      // token en este endpoint (como en el resto del sistema), esto
      // probablemente fallaba con 401 y, al no haber "error:", quedaba
      // en silencio total.
      { headers: this.getHeaders() }
    ).subscribe({
      next: (res) => {
        this.savingSettings = false;
        this.companyService.setCompany(res);

        this.toastr.success('Configuración guardada');
        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error('Error guardando configuración:', err);
        this.savingSettings = false;
        this.toastr.error(this.getErrorMessage(err, 'No se pudo guardar la configuración'));
        this.cdRef.detectChanges();
      }
    });
  }

  onFileSelected(event: any) {

    const file = event.target.files[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      // Se achica a 300 px como máximo antes de guardarlo: un logo de varios
      // MB hacía todo más lento y gastaba ancho de banda en cada carga.
      this.resizeImage(reader.result as string, 300)
        .then(small => {
          this.logoUrl = small;
          this.cdRef.detectChanges();
        })
        .catch(() => {
          this.toastr.error('No se pudo procesar la imagen');
        });
    };

    reader.onerror = () => {
      // NUEVO: si falla la lectura del archivo (archivo corrupto, muy
      // grande, etc.) antes no había ningún aviso.
      this.toastr.error('No se pudo leer el archivo de imagen');
    };

    reader.readAsDataURL(file);
  }

  onLogoError() {
    this.logoUrl = null;
  }

  upload() {
    if (!this.logoUrl){
      this.toastr.error('No se ha seleccionado un logo');
      return;
    }

    if (this.uploadingLogo) return;
    this.uploadingLogo = true;

    this.http.post<any>(
      `${API_URL}/companies/logo`,
      {
        logo: this.logoUrl
      },
      // ANTES: mismo problema, faltaba el header de autenticación
      { headers: this.getHeaders() }
    ).subscribe({
      next: (res) => {
        this.uploadingLogo = false;
        this.companyService.setCompany(res);
        this.logoUrl = res.logo || null;

        this.toastr.success('Logo actualizado');
        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error('Error subiendo logo:', err);
        this.uploadingLogo = false;
        this.toastr.error(this.getErrorMessage(err, 'No se pudo actualizar el logo'));
        this.cdRef.detectChanges();
      }
    });
  }

  // Achica una imagen (data URL) para que su lado más largo mida como mucho
  // maxSize píxeles. Usa WebP (mantiene transparencia y pesa poco) y, si el
  // navegador no lo soporta, PNG.
  private resizeImage(dataUrl: string, maxSize: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject();
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);

        const webp = canvas.toDataURL('image/webp', 0.9);
        resolve(webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject();
      img.src = dataUrl;
    });
  }
}
