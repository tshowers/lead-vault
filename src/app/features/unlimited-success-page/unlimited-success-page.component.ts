import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { LeadVaultApiService } from '../../services/lead-vault-api.service';

/** Ported near-verbatim from lead-vault-unlimited-success-page.component.ts - only dependency is LeadVaultApiService. */
@Component( {
  selector: 'app-unlimited-success-page',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './unlimited-success-page.component.html',
  styleUrl: './unlimited-success-page.component.css'
} )
export class UnlimitedSuccessPageComponent implements OnInit {
  isLoading = true;
  errorMessage = '';
  statusMessage = 'Activating your subscription...';
  sessionId = '';

  constructor (
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly leadVaultService: LeadVaultApiService
  ) { }

  ngOnInit (): void {
    this.sessionId = ( this.route.snapshot.queryParamMap.get( 'session_id' ) || '' ).trim();

    if ( !this.sessionId ) {
      this.isLoading = false;
      this.errorMessage = 'Stripe session id is missing.';
      return;
    }

    this.confirmSubscription();
  }

  private confirmSubscription (): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.statusMessage = 'Activating your subscription...';

    this.leadVaultService.confirmUnlimitedCheckout( this.sessionId ).subscribe( {
      next: () => {
        this.statusMessage = 'Subscription activated. Redirecting to Lead Vault...';
        setTimeout( () => {
          this.router.navigate( ['/'] );
        }, 1200 );
      },
      error: ( error ) => {
        this.isLoading = false;
        this.errorMessage =
          error?.error?.message ||
          error?.message ||
          'Lead Vault Unlimited subscription confirmation failed.';
      }
    } );
  }
}
