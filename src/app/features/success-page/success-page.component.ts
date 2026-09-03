import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { LeadVaultApiService } from '../../services/lead-vault-api.service';

/**
 * Ported near-verbatim from lead-vault-success-page.component.ts - only
 * dependency is LeadVaultApiService. Route targets adjusted for the
 * standalone app's shortened paths (/lead-vault/full/:id -> /full/:id,
 * /lead-vault -> /).
 */
@Component( {
  selector: 'app-success-page',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './success-page.component.html',
  styleUrl: './success-page.component.css'
} )
export class SuccessPageComponent implements OnInit {
  isLoading = true;
  errorMessage = '';
  statusMessage = 'Confirming your purchase...';
  sessionId = '';
  purchaseType = 'unlock';

  constructor (
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly leadVaultService: LeadVaultApiService
  ) { }

  ngOnInit (): void {
    this.sessionId = ( this.route.snapshot.queryParamMap.get( 'session_id' ) || '' ).trim();
    this.purchaseType = ( this.route.snapshot.queryParamMap.get( 'type' ) || 'unlock' ).trim().toLowerCase();

    if ( !this.sessionId ) {
      this.isLoading = false;
      this.errorMessage = 'Stripe session id is missing.';
      return;
    }

    if ( this.purchaseType === 'recommendation' ) {
      this.confirmRecommendationPurchase();
      return;
    }

    this.confirmPurchase();
  }

  private confirmPurchase (): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.statusMessage = 'Confirming your purchase...';

    this.leadVaultService.confirmCheckout( this.sessionId ).subscribe( {
      next: ( response ) => {
        const recordId = ( response?.recordId || '' ).trim();
        const email = ( response?.email || '' ).trim().toLowerCase();

        if ( !recordId || !email ) {
          this.isLoading = false;
          this.errorMessage = 'Purchase was confirmed but the record details are incomplete.';
          return;
        }

        localStorage.setItem( 'leadVaultEmail', email );
        this.statusMessage = 'Purchase confirmed. Opening your lead...';

        setTimeout( () => {
          this.router.navigate( ['/full', recordId], {
            queryParams: { email }
          } );
        }, 600 );
      },
      error: ( error ) => {
        this.isLoading = false;
        this.errorMessage =
          error?.error?.message ||
          error?.message ||
          'Lead Vault purchase confirmation failed.';
      }
    } );
  }

  private confirmRecommendationPurchase (): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.statusMessage = 'Confirming your recommendation purchase...';

    this.leadVaultService.confirmRecommendationCheckout( this.sessionId ).subscribe( {
      next: ( response ) => {
        const recordId = ( response?.recordId || '' ).trim();
        const email = ( response?.email || '' ).trim().toLowerCase();
        const goal = ( response?.goal || '' ).trim();

        if ( !recordId || !email ) {
          this.isLoading = false;
          this.errorMessage = 'Recommendation purchase was confirmed but the record details are incomplete.';
          return;
        }

        localStorage.setItem( 'leadVaultEmail', email );
        this.statusMessage = 'Recommendation purchase confirmed. Opening your lead...';

        setTimeout( () => {
          this.router.navigate( ['/full', recordId], {
            queryParams: {
              email,
              session_id: this.sessionId,
              type: 'recommendation',
              ...( goal ? { goal } : {} )
            }
          } );
        }, 600 );
      },
      error: ( error ) => {
        this.isLoading = false;
        this.errorMessage =
          error?.error?.message ||
          error?.message ||
          'Lead Vault recommendation confirmation failed.';
      }
    } );
  }
}
