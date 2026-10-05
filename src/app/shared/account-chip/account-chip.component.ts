import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { LeadVaultAuthService } from '../../services/lead-vault-auth.service';
import { LeadVaultViewerService } from '../../services/lead-vault-viewer.service';
import { LeadVaultAccessLevel } from '../../services/lead-vault-api.service';

const PLAN_NAMES: Record<LeadVaultAccessLevel, string> = {
  'master-tenant': 'Master',
  'suite-subscriber': 'Suite',
  'unlimited-subscriber': 'Unlimited',
  'free-trial-available': '1 free reveal',
  'none': 'Pay per lead',
};

/**
 * Header pill next to the theme pill: "Sign in" for visitors, or the
 * signed-in TODD email plus what it unlocks (master / Suite / Unlimited /
 * free reveal / pay per lead), with sign-out behind a click.
 */
@Component( {
  selector: 'app-account-chip',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './account-chip.component.html',
  styleUrl: './account-chip.component.css',
} )
export class AccountChipComponent {
  readonly viewer$ = inject( LeadVaultViewerService ).viewer$;
  isOpen = false;

  constructor (
    private readonly authService: LeadVaultAuthService,
    private readonly router: Router,
  ) { }

  signIn (): void {
    this.authService.signIn( this.router.url );
  }

  async signOut (): Promise<void> {
    this.isOpen = false;
    await this.authService.signOut();
    try {
      localStorage.removeItem( 'leadVaultEmail' );
    } catch { /* storage blocked - nothing to clear */ }
  }

  /** "ty.showers@…" → "TS". */
  initials ( email: string ): string {
    const parts = ( email.split( '@' )[0] || '' ).split( /[._\-+]+/ ).filter( Boolean );
    const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : ( parts[0] || '?' ).slice( 0, 2 );
    return letters.toUpperCase();
  }

  planName ( level: LeadVaultAccessLevel ): string {
    return PLAN_NAMES[level] || PLAN_NAMES.none;
  }

  toggle (): void {
    this.isOpen = !this.isOpen;
  }
}
