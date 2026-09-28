import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { CompanyService } from './services/company.service';

// Lee la fecha de vencimiento que viene adentro del token (JWT)
// y dice si ya pasó. Si el token está roto, lo tomamos como vencido.
export function isTokenExpired(token: string | null): boolean {
  if (!token || token === 'undefined') return true;

  try {
    const payload = token.split('.')[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const data = JSON.parse(atob(payload));

    if (!data.exp) return false;

    // exp viene en segundos; Date.now() en milisegundos
    return Date.now() >= data.exp * 1000;
  } catch {
    return true;
  }
}

export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  const toastr = inject(ToastrService);
  const companyService = inject(CompanyService);

  const token = localStorage.getItem('token');

  if (!isTokenExpired(token)) {
    return true;
  }

  // Había un token pero venció: avisamos. Si no había nada, solo redirigimos.
  if (token && token !== 'undefined') {
    toastr.warning('Tu sesión expiró. Iniciá sesión de nuevo.');
  }

  companyService.clear();
  return router.createUrlTree(['/login']);
};
