import { isPlatformBrowser } from '@angular/common';
import { Component, PLATFORM_ID, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AsyncPipe } from '@angular/common';
import { map } from 'rxjs';
import { ThemeMode, currentTheme, initTheme, toggleTheme } from '@taliferro/ui/platform/theme';

import { LeadVaultAuthService } from '../../services/lead-vault-auth.service';
import { AccountChipComponent } from '../account-chip/account-chip.component';
import { PlatformMenuComponent } from '../platform-menu/platform-menu.component';

/**
 * Lead Vault's header (design_handoff_music_leadvault_network 14a/14e):
 * logo and name, the account pill, the Light/Dark pill and the Menu pill.
 */
@Component( {
  selector: 'app-header',
  standalone: true,
  imports: [AsyncPipe, RouterLink, AccountChipComponent, PlatformMenuComponent],
  templateUrl: './app-header.component.html',
} )
export class AppHeaderComponent {
  private readonly authService = inject( LeadVaultAuthService );
  private readonly router = inject( Router );
  private readonly isBrowser = isPlatformBrowser( inject( PLATFORM_ID ) );

  readonly isLoggedIn$ = this.authService.isLoggedIn();
  readonly userName$ = this.authService.getUser().pipe( map( user => user?.displayName || '' ) );
  readonly userEmail$ = this.authService.getUser().pipe( map( user => user?.email || '' ) );

  /** The mode on screen; the pill offers the other one. */
  readonly theme = signal<ThemeMode>( 'light' );

  constructor () {
    if ( this.isBrowser ) {
      initTheme();
      this.theme.set( currentTheme() );
    }
  }

  toggleTheme (): void {
    this.theme.set( toggleTheme() );
  }

  signIn (): void {
    this.authService.signIn( this.router.url );
  }

  async signOut (): Promise<void> {
    await this.authService.signOut();
  }
}
