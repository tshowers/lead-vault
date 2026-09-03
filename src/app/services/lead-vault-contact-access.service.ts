import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { LeadVaultAuthService } from './lead-vault-auth.service';

export interface ContactAccessState {
  isLoggedIn: boolean;
  isPaidUser: boolean;
  contactCount: number;
  contactLimit: number;
  remainingFreeContacts: number;
  canAddContact: boolean;
}

/**
 * Copied from web-products/network's NetworkContactAccessService (itself
 * ported from the monorepo's contact-access.service.ts, trimmed of the
 * Cypress test-auth override), auth-swapped to LeadVaultAuthService. The
 * full-record page's addToTodd() reads isLoggedIn/isPaidUser/
 * canAddContact off this exactly the way Network's pages do, so no further
 * trimming was needed - this is already the shape this extraction needs.
 */
@Injectable( { providedIn: 'root' } )
export class LeadVaultContactAccessService {
  readonly freeContactLimit = 10;

  constructor ( private authService: LeadVaultAuthService ) { }

  async getAccessState (): Promise<ContactAccessState> {
    const user = await new Promise<any>( ( resolve ) => {
      const sub = this.authService.getUser().subscribe( ( u ) => {
        resolve( u );
        setTimeout( () => sub.unsubscribe() );
      } );
    } );

    if ( !user ) {
      return {
        isLoggedIn: false,
        isPaidUser: false,
        contactCount: 0,
        contactLimit: this.freeContactLimit,
        remainingFreeContacts: this.freeContactLimit,
        canAddContact: false,
      };
    }

    const tenantId = await this.authService.resolveTenantId( user.uid );
    const entitlement = await this.fetchEntitlement( tenantId, user.uid, user.email || '' );

    const contactCount = Number( entitlement.currentCount ) || 0;
    const isPaidUser = !!entitlement.hasNetwork;
    const contactLimit = isPaidUser
      ? Math.max( 0, Number( entitlement.effectiveLimit ) || 0 )
      : this.freeContactLimit;
    const remainingFreeContacts = Math.max( 0, contactLimit - contactCount );

    return {
      isLoggedIn: true,
      isPaidUser,
      contactCount,
      contactLimit,
      remainingFreeContacts,
      canAddContact: remainingFreeContacts > 0,
    };
  }

  private async fetchEntitlement ( tenantId: string, userId: string, userEmail: string ): Promise<{ hasNetwork: boolean; effectiveLimit: number; currentCount: number; }> {
    if ( !tenantId ) return { hasNetwork: false, effectiveLimit: 0, currentCount: 0 };

    try {
      const response = await fetch( `${environment.backendURL}/network/entitlement`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId,
          'x-user-id': userId,
          ...( userEmail ? { 'x-user-email': userEmail } : {} ),
        },
        body: JSON.stringify( { tenantId } ),
      } );

      const result = await response.json().catch( () => ( {} ) );
      if ( !response.ok || !result?.success ) {
        throw new Error( result?.message || 'Unable to load contact entitlement.' );
      }

      return {
        hasNetwork: !!result?.hasNetwork,
        effectiveLimit: Number( result?.effectiveLimit ) || 0,
        currentCount: Number( result?.currentCount ) || 0,
      };
    } catch {
      return { hasNetwork: false, effectiveLimit: 0, currentCount: 0 };
    }
  }
}
