import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { EMPTY, catchError, throwError } from 'rxjs';
import { CompanyService } from './services/company.service';

// Evita que salgan varios avisos juntos cuando fallan
// varias llamadas al mismo tiempo (por ejemplo, al cargar una pantalla).
let redirectingToLogin = false;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const toastr = inject(ToastrService);
  const companyService = inject(CompanyService);

  const token = localStorage.getItem('token');

  if (token && token !== 'undefined') {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      const isAuthRequest = req.url.includes('/auth/');

      // 401 = el servidor rechazó el token (vencido o inválido).
      // Cerramos la sesión y mandamos al login con un aviso claro.
      if (err.status === 401 && !isAuthRequest) {
        if (!redirectingToLogin) {
          redirectingToLogin = true;
          companyService.clear();
          toastr.warning('Tu sesión expiró. Iniciá sesión de nuevo.');
          router.navigate(['/login']).finally(() => {
            redirectingToLogin = false;
          });
        }
        // No pasamos el error a la pantalla, así no aparecen
        // mensajes de error extra además del aviso de sesión.
        return EMPTY;
      }

      return throwError(() => err);
    })
  );
};
