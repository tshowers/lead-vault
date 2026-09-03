import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { LeadVaultAuthService } from './lead-vault-auth.service';

/**
 * Copied from web-products/network's NetworkContactPackService, logic
 * unchanged, auth-swapped to LeadVaultAuthService. Same shared
 * /network/contact-pack/checkout endpoint as Network - this is a
 * tenant-wide TODD contact-capacity gate, not specific to which extracted
 * app triggered it.
 */
@Injectable( { providedIn: 'root' } )
export class LeadVaultContactPackService {
  readonly limitErrorMessage = "You've reached your contact limit. Add another 1,000-contact pack to continue.";
  readonly upgradePromptMessage = "You've reached your 1,000 contact limit\nAdd another 1,000 contacts for $19/month?";

  constructor ( private readonly authService: LeadVaultAuthService ) { }

  isContactLimitError ( error: any ): boolean {
    const message = String( error?.message || error?.error?.message || '' ).trim();
    return message === this.limitErrorMessage;
  }

  async startCheckout (): Promise<void> {
    const tenantId = this.authService.getCurrentUserIdSync();
    if ( !tenantId ) {
      throw new Error( 'Please sign in before adding another contact pack.' );
    }

    const response = await fetch( `${environment.backendURL}/network/contact-pack/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': tenantId,
        'x-user-id': tenantId,
      },
      body: JSON.stringify( { tenantId } ),
    } );

    const result = await response.json().catch( () => ( {} ) );

    if ( !response.ok || !result?.url ) {
      throw new Error( result?.message || 'Unable to start contact pack checkout.' );
    }

    window.location.href = result.url;
  }

  async promptAndStartCheckout (): Promise<boolean> {
    if ( typeof window === 'undefined' ) return false;

    const confirmed = window.confirm( this.upgradePromptMessage );
    if ( !confirmed ) return false;

    await this.startCheckout();
    return true;
  }
}
