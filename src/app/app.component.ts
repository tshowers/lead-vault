import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';

import { LeadVaultAuthService } from './services/lead-vault-auth.service';

import { ToastComponent } from './shared/toast/toast.component';
import { PlatformMenuComponent } from './shared/platform-menu/platform-menu.component';
import { AccountChipComponent } from './shared/account-chip/account-chip.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastComponent, AccountChipComponent, PlatformMenuComponent, AsyncPipe],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  private readonly authService = inject( LeadVaultAuthService );
  private readonly router = inject( Router );
  readonly isLoggedIn$ = this.authService.isLoggedIn();
  readonly userName$ = this.authService.getUser().pipe( map( user => user?.displayName || '' ) );
  readonly userEmail$ = this.authService.getUser().pipe( map( user => user?.email || '' ) );

  title = 'lead-vault';

  signIn (): void {
    this.authService.signIn( this.router.url );
  }

  async signOut (): Promise<void> {
    await this.authService.signOut();
  }
}
