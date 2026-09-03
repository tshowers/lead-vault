import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { LeadVaultApiService } from '../../services/lead-vault-api.service';
import { LeadVaultAuthService } from '../../services/lead-vault-auth.service';
import { isInvalidLeadVaultRecordId } from '../../utils/lead-vault-record-id.util';
import { PreloaderComponent } from '../../shared/preloader/preloader.component';

/**
 * Trimmed, near-verbatim port of lead-vault-preview-page.component.ts.
 * Only real deps: LeadVaultApiService, LeadVaultAuthService, PreloaderComponent,
 * isInvalidLeadVaultRecordId. Two deliberate deviations from the original:
 *  - Route targets shortened for this app (/lead-vault/full/:id -> /full/:id,
 *    /lead-vault -> /, /suite/pricing dropped - no Suite pricing page exists
 *    in this standalone app, so that upsell link is removed rather than
 *    pointed at a route that doesn't exist here).
 *  - The original redirects invalid record ids to a monorepo-wide
 *    `/bad-request` error page that isn't part of Lead Vault's own route
 *    map (see lead-vault.routes.ts) and isn't in this extraction's scope -
 *    redirected to `/` (the search page) instead.
 *  - `[autoHideAfterMs]` isn't ported: the copied PreloaderComponent (from
 *    web-products/network) is the trimmed plain-spinner version without
 *    that input.
 */
@Component( {
  selector: 'app-preview-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, PreloaderComponent],
  templateUrl: './preview-page.component.html',
  styleUrl: './preview-page.component.css'
} )
export class PreviewPageComponent implements OnInit {
  recordId = '';
  purchaserEmail = '';
  isLoading = true;
  isCheckingAccess = false;
  isStartingCheckout = false;
  errorMessage = '';
  accessMessage = '';
  accessChecked = false;
  hasAccess = false;
  previewRecord: {
    id: string;
    teaserName: string;
    teaserTitle: string;
    teaserCompanyName: string;
    teaserLocation: string;
    sector: string;
    capabilities: string[];
    emailMasked: string;
    qualityScore: number;
    locked: boolean;
  } | null = null;

  constructor (
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly leadVaultService: LeadVaultApiService,
    private readonly authService: LeadVaultAuthService,
  ) { }

  ngOnInit (): void {
    this.recordId = ( this.route.snapshot.paramMap.get( 'id' ) || '' ).trim();
    this.purchaserEmail = this.getStoredLeadVaultEmail();

    if ( isInvalidLeadVaultRecordId( this.recordId ) ) {
      this.router.navigate( ['/'], { replaceUrl: true } );
      return;
    }

    this.loadPreview();
  }
  getScoreTier ( score: number ): 'strong' | 'good' | 'fair' {
    if ( score >= 80 ) return 'strong';
    if ( score >= 60 ) return 'good';
    return 'fair';
  }

  onEmailChange ( value: string ): void {
    this.purchaserEmail = ( value || '' ).trim().toLowerCase();
  }

  checkAccess (): void {
    const email = this.normalizeEmail( this.purchaserEmail );

    if ( !this.recordId ) {
      this.errorMessage = 'Lead Vault record id is missing.';
      return;
    }

    if ( !email ) {
      this.errorMessage = 'Enter your email to continue.';
      return;
    }

    this.errorMessage = '';
    this.accessMessage = '';
    this.accessChecked = false;
    this.isCheckingAccess = true;
    this.storeLeadVaultEmail( email );

    this.leadVaultService.checkAccess( this.recordId, email ).subscribe( {
      next: ( response ) => {
        this.hasAccess = !!response?.hasAccess;
        this.isCheckingAccess = false;
        this.accessChecked = true;

        if ( this.hasAccess ) {
          this.accessMessage = 'Access found. Opening full record...';
          this.router.navigate( ['/full', this.recordId], {
            queryParams: { email }
          } );
          return;
        }

        this.accessMessage = 'No prior access found. Unlock this lead for $29, or sign up for Suite for unlimited Lead Vault access.';
      },
      error: ( error ) => {
        this.hasAccess = false;
        this.accessChecked = false;
        this.isCheckingAccess = false;
        this.errorMessage =
          error?.error?.message ||
          error?.message ||
          'Lead Vault access check failed.';
      }
    } );
  }

  unlockRecord (): void {
    const email = this.normalizeEmail( this.purchaserEmail );

    if ( !this.recordId ) {
      this.errorMessage = 'Lead Vault record id is missing.';
      return;
    }

    if ( !email ) {
      this.errorMessage = 'Enter your email before unlocking this lead.';
      return;
    }

    this.errorMessage = '';
    this.accessMessage = '';
    this.isStartingCheckout = true;
    this.storeLeadVaultEmail( email );

    this.leadVaultService.createCheckout( this.recordId, email ).subscribe( {
      next: ( response ) => {
        this.isStartingCheckout = false;

        if ( response?.alreadyOwned ) {
          this.router.navigate( ['/full', this.recordId], {
            queryParams: { email }
          } );
          return;
        }

        if ( response?.checkoutUrl ) {
          window.location.href = response.checkoutUrl;
          return;
        }

        this.errorMessage = 'Stripe checkout URL was not returned.';
      },
      error: ( error ) => {
        this.isStartingCheckout = false;
        this.errorMessage =
          error?.error?.message ||
          error?.message ||
          'Lead Vault checkout failed.';
      }
    } );
  }

  private loadPreview (): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.leadVaultService.getPreview( this.recordId ).subscribe( {
      next: ( response ) => {
        this.previewRecord = response?.record || null;
        this.isLoading = false;

        if ( !this.previewRecord ) {
          this.errorMessage = 'Lead Vault record was not found.';
          return;
        }

        if ( this.purchaserEmail ) {
          this.checkAccess();
        }
      },
      error: ( error ) => {
        this.previewRecord = null;
        this.isLoading = false;
        this.errorMessage =
          error?.error?.message ||
          error?.message ||
          'Lead Vault preview failed.';
      }
    } );
  }

  private getStoredLeadVaultEmail (): string {
    const queryEmail = this.normalizeEmail( this.route.snapshot.queryParamMap.get( 'email' ) || '' );
    if ( queryEmail ) {
      this.storeLeadVaultEmail( queryEmail );
      return queryEmail;
    }

    const storedEmail = this.normalizeEmail( localStorage.getItem( 'leadVaultEmail' ) || '' );

    if ( storedEmail ) {
      return storedEmail;
    }

    const signedInEmail = this.normalizeEmail( this.authService.getCurrentUserEmailSync() );
    if ( signedInEmail ) {
      this.storeLeadVaultEmail( signedInEmail );
    }

    return signedInEmail;
  }

  private storeLeadVaultEmail ( email: string ): void {
    localStorage.setItem( 'leadVaultEmail', this.normalizeEmail( email ) );
  }

  private normalizeEmail ( email: string ): string {
    return ( email || '' ).trim().toLowerCase();
  }
}
