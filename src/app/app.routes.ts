import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'record/:id',
    loadComponent: () =>
      import( './features/preview-page/preview-page.component' ).then( ( m ) => m.PreviewPageComponent ),
  },
  {
    path: 'cancel',
    loadComponent: () =>
      import( './features/cancel-page/cancel-page.component' ).then( ( m ) => m.CancelPageComponent ),
  },
  {
    path: 'success',
    loadComponent: () =>
      import( './features/success-page/success-page.component' ).then( ( m ) => m.SuccessPageComponent ),
  },
  {
    path: 'unlimited-success',
    loadComponent: () =>
      import( './features/unlimited-success-page/unlimited-success-page.component' ).then( ( m ) => m.UnlimitedSuccessPageComponent ),
  },
];
