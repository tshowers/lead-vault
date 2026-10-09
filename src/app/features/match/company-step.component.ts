import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NaicsPickerComponent } from './controls/naics-picker.component';
import { MatchStore } from './match-store.service';

/**
 * Match Maker step 1, restyled: the company being matched for. Its NAICS
 * codes come back as one-click suggestions on the criteria step, and the
 * whole company goes to the AI so it can explain the pick for that company.
 */
@Component( {
  selector: 'lv-company-step',
  standalone: true,
  imports: [ FormsModule, NaicsPickerComponent ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="lvm-page lvm-page--narrow">
      <h1 class="lvm-title">Who are you matching for?</h1>
      <p class="lvm-sub">Enter the company and its website. We find the best partners for it in Lead Vault.</p>

      <form class="lvm-company-form" (ngSubmit)="continue()">
        <label class="lvm-field">
          <span>Company name</span>
          <input class="lv-field" name="name" [ngModel]="name()" (ngModelChange)="name.set( $event )" required autocomplete="organization" placeholder="Northwind Federal Systems" />
        </label>
        <label class="lvm-field">
          <span>Homepage URL</span>
          <input class="lv-field" name="url" type="url" inputmode="url" [ngModel]="url()" (ngModelChange)="url.set( $event )" placeholder="northwindfederal.com" />
        </label>
        <label class="lvm-field">
          <span>What they do <small>Optional, one line</small></span>
          <input class="lv-field" name="description" [ngModel]="description()" (ngModelChange)="description.set( $event )" maxlength="200" placeholder="Federal IT integrator serving civilian agencies" />
        </label>
        <div class="lvm-field">
          <span>NAICS codes they hold <small>Optional, offered as criteria next</small></span>
          <lv-naics-picker [selected]="naics()" (add)="toggleNaics( $event )" (remove)="toggleNaics( $event )" />
        </div>

        <div class="lvm-actions">
          <button type="button" class="lv-link" (click)="skip()">Skip, use criteria only</button>
          <button type="submit" class="lv-btn lvm-btn--blue" [disabled]="!canContinue()">
            Next: criteria
            <svg class="lv-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
        </div>
      </form>
    </main>
  `,
} )
export class CompanyStepComponent {
  private readonly store = inject( MatchStore );
  private readonly router = inject( Router );

  private readonly current = this.store.company();
  protected readonly name = signal( this.current?.name || '' );
  protected readonly url = signal( this.current?.url || '' );
  protected readonly description = signal( this.current?.description || '' );
  protected readonly naics = signal<string[]>( this.current?.naics || [] );
  protected readonly canContinue = computed( () => this.name().trim().length > 1 );

  constructor () {
    this.store.path.set( 'match' );
  }

  protected toggleNaics ( code: string ): void {
    this.naics.update( ( codes ) => codes.includes( code ) ? codes.filter( ( item ) => item !== code ) : [ ...codes, code ] );
  }

  protected continue (): void {
    if ( !this.canContinue() ) return;
    this.store.setCompany( {
      name: this.name().trim(),
      url: this.url().trim(),
      description: this.description().trim(),
      naics: this.naics(),
    } );
    this.router.navigate( [ '/match/criteria' ] );
  }

  protected skip (): void {
    this.store.useCriteriaOnly();
    this.router.navigate( [ '/match/criteria' ] );
  }
}
