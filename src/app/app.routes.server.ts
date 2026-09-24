import { RenderMode, ServerRoute } from '@angular/ssr';

// auth/callback's consumePendingLogin() calls sessionStorage.getItem
// unconditionally (LeadVaultAuthService) — unsafe to evaluate at build time
// in Node. The checkout-flow pages (success/cancel/unlimited-success) and
// the search homepage are dynamic/session-driven and don't need static
// content anyway. Only the two purely static content pages are prerendered.
export const serverRoutes: ServerRoute[] = [
  { path: 'help', renderMode: RenderMode.Prerender },
  { path: 'about', renderMode: RenderMode.Prerender },
  { path: '**', renderMode: RenderMode.Client },
];
