import { ApplicationConfig, isDevMode } from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';
import { provideRouter, withRouterConfig } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { routes } from './app.routes';
import { authInterceptor } from './auth.interceptor';
import { offlineInterceptor } from './offline/offline.interceptor';
import { provideToastr } from 'ngx-toastr';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(
      routes,
      withRouterConfig( {
        onSameUrlNavigation: 'reload'
      })
    ),
    provideHttpClient(withInterceptors([authInterceptor, offlineInterceptor])),
    provideAnimations(),
    // Guarda el sistema en la computadora para que abra aunque no haya internet
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    }),
    provideToastr({
      positionClass: 'toast-bottom-right',
      timeOut: 3000,
      progressBar: true,
    })
  ]
};
