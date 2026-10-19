import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { API_URL, OfflineService, SKIP_OFFLINE } from './offline.service';

// Pasa los pedidos al servidor por OfflineService, que decide si van al
// servidor o se resuelven en esta computadora (cuando no hay internet).
export const offlineInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(API_URL) || req.context.get(SKIP_OFFLINE)) {
    return next(req);
  }

  const path = req.url.substring(API_URL.length);
  if (path.startsWith('/auth')) {
    return next(req);
  }

  const offline = inject(OfflineService);
  if (!offline.hasSession()) {
    return next(req);
  }

  return offline.handle(req, next);
};
