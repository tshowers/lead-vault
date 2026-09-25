import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { environment } from '../../environments/environment';
import { LeadVaultAuthService } from './lead-vault-auth.service';

/**
 * Sends the signed-in TODD user's Firebase ID token with every Lead Vault
 * API call. The backend verifies it to recognize master-tenant, TODD Suite,
 * and Lead Vault Unlimited users, so their records open without a per-lead
 * purchase. Anonymous visitors go out unchanged. A call that already set its
 * own Authorization header (validate-email) is left alone.
 */
export const leadVaultAuthInterceptor: HttpInterceptorFn = ( req, next ) => {
  if (
    typeof window === 'undefined' ||
    !req.url.startsWith( environment.backendURL ) ||
    req.headers.has( 'Authorization' )
  ) {
    return next( req );
  }

  const authService = inject( LeadVaultAuthService );
  const token = authService.whenReady().then( () => authService.getIdToken() ).catch( () => null );

  return from( token ).pipe(
    switchMap( ( idToken ) => next(
      idToken ? req.clone( { setHeaders: { Authorization: `Bearer ${idToken}` } } ) : req,
    ) ),
  );
};
