import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { initializeApp } from 'firebase/app';

import { routes } from './app.routes';
import { leadVaultAuthInterceptor } from './services/lead-vault-auth.interceptor';
import { environment } from '../environments/environment';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';

initializeApp( environment.firebaseConfig );

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptors([leadVaultAuthInterceptor])), provideClientHydration(withEventReplay()),
  ]
};
