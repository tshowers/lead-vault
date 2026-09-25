import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { LeadVaultAuthService } from '../../services/lead-vault-auth.service';
import { LeadVaultViewerService } from '../../services/lead-vault-viewer.service';

/**
 * Header badge next to the platform menu: "Sign in" for visitors, or the
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

  toggle (): void {
    this.isOpen = !this.isOpen;
  }
}
