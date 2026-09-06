import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { LeadVaultAuthService } from '../../services/lead-vault-auth.service';

@Component( {
  selector: 'app-lead-vault-auth-callback',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="auth-callback-shell">
      <ng-container *ngIf="!errorMessage"><p>Signing you in...</p></ng-container>
      <div class="alert alert-danger" *ngIf="errorMessage">{{ errorMessage }}</div>
    </div>
  `,
  styles: [`
    .auth-callback-shell { align-items: center; display: flex; justify-content: center;
      min-height: 60vh; padding: 24px; text-align: center; }
  `],
} )
export class AuthCallbackComponent implements OnInit {
  errorMessage = '';

  constructor (
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly authService: LeadVaultAuthService,
  ) { }

  async ngOnInit (): Promise<void> {
    const token = this.route.snapshot.queryParamMap.get( 'token' );
    const state = this.route.snapshot.queryParamMap.get( 'state' );
    const pending = this.authService.consumePendingLogin( state );

    if ( !token || !pending ) {
      this.errorMessage = 'This sign-in session is invalid or expired. Please try again.';
      return;
    }

    try {
      await this.authService.signInWithCustomToken( token );
      await this.router.navigateByUrl( pending.returnUrl || '/' );
    } catch ( error: any ) {
      this.errorMessage = error?.message || 'Sign-in failed. Please try again.';
    }
  }
}
