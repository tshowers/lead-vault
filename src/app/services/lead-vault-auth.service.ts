import { Injectable } from '@angular/core';
import {
  Auth,
  getAuth,
  onAuthStateChanged,
  signInWithCustomToken,
  signOut,
  User,
} from 'firebase/auth';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { Observable, shareReplay, switchMap, of } from 'rxjs';

/**
 * Trimmed, purpose-built auth service for the standalone Lead Vault app -
 * copied from web-products/network's NetworkAuthService (same shape, same
 * tenant-resolution rule), but expected to be lightly used in practice:
 * Lead Vault's search/preview/purchase flow is keyed mostly by email, not
 * by a signed-in tenant - only the "Add to Contact" and unlimited-
 * subscription checkout flows on the full-record page actually need a
 * signed-in TODD user.
 */
@Injectable( { providedIn: 'root' } )
export class LeadVaultAuthService {
  private get auth (): Auth {
    return getAuth();
  }

  private userId$?: Observable<string>;
  private tenantId$?: Observable<string>;

  getUser (): Observable<User | null> {
    return new Observable( ( subscriber ) => {
      const unsubscribe = onAuthStateChanged( this.auth, ( user ) => subscriber.next( user ) );
      return unsubscribe;
    } );
  }

  /** Matches TODD's own AuthService.getUserId() shape - components ported
   * from features/* call this by name, so keeping the signature identical
   * means the rest of a component's logic ports unchanged. */
  getUserId (): Observable<string> {
    if ( !this.userId$ ) {
      this.userId$ = new Observable<string>( ( subscriber ) => {
        const unsubscribe = onAuthStateChanged( this.auth, ( user ) => subscriber.next( user?.uid || '' ) );
        return unsubscribe;
      } ).pipe( shareReplay( { bufferSize: 1, refCount: false } ) );
    }
    return this.userId$;
  }

  /** Resolved once per session and shared. */
  getTenantId (): Observable<string> {
    if ( !this.tenantId$ ) {
      this.tenantId$ = this.getUserId().pipe(
        switchMap( ( uid ) => ( uid ? this.resolveTenantId( uid ) : of( '' ) ) ),
        shareReplay( { bufferSize: 1, refCount: false } ),
      );
    }
    return this.tenantId$;
  }

  isLoggedIn (): Observable<boolean> {
    return new Observable( ( subscriber ) => {
      const unsubscribe = onAuthStateChanged( this.auth, ( user ) => subscriber.next( !!user ) );
      return unsubscribe;
    } );
  }

  getCurrentUserIdSync (): string {
    return this.auth.currentUser?.uid || '';
  }

  /** Used by the preview/full-record pages to pre-fill the purchaser email for a signed-in user, synchronously. */
  getCurrentUserEmailSync (): string {
    return this.auth.currentUser?.email || '';
  }

  signIn ( returnUrl?: string ): void {
    const state = crypto.randomUUID();
    sessionStorage.setItem( 'lead_vault_hosted_login_pending', JSON.stringify( { state, returnUrl } ) );
    const params = new URLSearchParams( { client: 'lead-vault-web', state } );
    window.location.href = `https://todd.taliferro.tech/login?${params.toString()}`;
  }

  consumePendingLogin ( state: string | null ): { returnUrl?: string } | null {
    const raw = sessionStorage.getItem( 'lead_vault_hosted_login_pending' );
    sessionStorage.removeItem( 'lead_vault_hosted_login_pending' );
    if ( !raw || !state ) return null;

    try {
      const pending = JSON.parse( raw ) as { state: string; returnUrl?: string };
      return pending.state === state ? { returnUrl: pending.returnUrl } : null;
    } catch {
      return null;
    }
  }

  async signInWithCustomToken ( token: string ): Promise<User> {
    const result = await signInWithCustomToken( this.auth, token );
    return result.user;
  }

  async signOut (): Promise<void> {
    await signOut( this.auth );
  }

  /**
   * Same rule as TODD's `users.service.ts`'s `getTenantLoggedInContactInfo` -
   * not a guess, kept identical to Network's own resolution.
   */
  async resolveTenantId ( uid: string ): Promise<string> {
    const snap = await getDoc( doc( getFirestore(), 'users', uid ) );
    const companyId = String( ( snap.data() as any )?.companyId || '' ).trim();
    return companyId || uid;
  }
}
