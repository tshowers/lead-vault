import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'cancel',
    loadComponent: () =>
      import( './features/cancel-page/cancel-page.component' ).then( ( m ) => m.CancelPageComponent ),
  },
];
