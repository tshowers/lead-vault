import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import( './features/search-page/search-page.component' ).then( ( m ) => m.SearchPageComponent ),
  },
  {
    path: 'record/:id',
    loadComponent: () =>
      import( './features/preview-page/preview-page.component' ).then( ( m ) => m.PreviewPageComponent ),
  },
  {
    path: 'full/:id',
    loadComponent: () =>
      import( './features/full-record-page/full-record-page.component' ).then( ( m ) => m.FullRecordPageComponent ),
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
  {
    path: 'auth/callback',
    loadComponent: () =>
      import( './features/auth-callback/auth-callback.component' ).then( ( m ) => m.AuthCallbackComponent ),
  },
  {
    path: 'help',
    loadComponent: () =>
      import( './features/help/help.component' ).then( ( m ) => m.HelpComponent ),
  },
  {
    path: 'about',
    loadComponent: () =>
      import( './features/about/about.component' ).then( ( m ) => m.AboutComponent ),
  },
];
