import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CompanyService {

  private companySubject = new BehaviorSubject<any>(
    JSON.parse(localStorage.getItem('company') || 'null')
  );

  company$ = this.companySubject.asObservable();

  setCompany(data: any) {

    // Separar el logo del resto para no llenar localStorage
    const { logo, ...companyWithoutLogo } = data;

    // Guardar company SIN logo
    localStorage.setItem('company', JSON.stringify(companyWithoutLogo));

    // Guardar logo por separado (puede ser null si no tiene)
    if (logo) {
      try {
        localStorage.setItem('company_logo', logo);
      } catch (e) {
        // Si el logo es demasiado grande y falla, lo ignoramos
        console.warn('Logo demasiado grande para localStorage');
        localStorage.removeItem('company_logo');
      }
    } else {
      localStorage.removeItem('company_logo');
    }

    // El subject lleva el objeto completo (con logo) para uso en memoria
    this.companySubject.next(data);

    document.documentElement.style.setProperty(
      '--primary-color',
      data.primaryColor || '#3b82f6'
    );

    if (data.darkMode) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }

  getCompany() {
    return this.companySubject.value;
  }

  getLogo(): string | null {
    return localStorage.getItem('company_logo');
  }

  // Al cerrar sesión: borra todo lo de la empresa anterior para que el
  // próximo usuario que entre en esta PC no vea su logo, colores ni carrito.
  clear() {
    localStorage.removeItem('token');
    localStorage.removeItem('company');
    localStorage.removeItem('company_logo');
    localStorage.removeItem('sales_cart');
    this.companySubject.next(null);
    document.documentElement.style.removeProperty('--primary-color');
    document.body.classList.remove('dark');
  }

  // Llamar al iniciar la app para rehidratar el logo en memoria
  rehydrate() {
    const company = JSON.parse(localStorage.getItem('company') || 'null');
    const logo = localStorage.getItem('company_logo');
    if (company) {
      this.companySubject.next({ ...company, logo: logo || null });
    }
  }
}