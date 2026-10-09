import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';
import { MatchApiService } from '../match-api.service';
import { MatchStore } from '../match-store.service';
import { MatchLocation, MatchRadius, MatchVocabulary } from '../match.models';
import { LocationPickerComponent } from './location-picker.component';
import { NaicsPickerComponent } from './naics-picker.component';
import { PillGroupComponent, PillOption } from './pill-group.component';

export type CriteriaGroupId = 'location' | 'industry' | 'naics' | 'certifications' | 'keywords';

export const CRITERIA_GROUPS: { id: CriteriaGroupId; title: string; hint: string; question: string; questionHint: string }[] = [
  { id: 'location', title: 'Location', hint: 'City, state or ZIP', question: 'Where should they be?', questionHint: 'Pick a place and a distance, or leave it as Anywhere.' },
  { id: 'industry', title: 'Industry', hint: 'Matches any you pick', question: 'What industry are they in?', questionHint: 'Pick any. Skip if it doesn’t matter.' },
  { id: 'naics', title: 'NAICS capabilities', hint: 'Weighted highest in the score', question: 'Which NAICS codes should they have?', questionHint: 'Search by code or by what the business does.' },
  { id: 'certifications', title: 'Certifications', hint: 'Matches any you pick', question: 'Which certifications should they hold?', questionHint: 'Pick any. Skip if it doesn’t matter.' },
  { id: 'keywords', title: 'Keywords', hint: 'Optional, searched in company profiles', question: 'Any words their profile should mention?', questionHint: 'Separate phrases with commas.' },
];

const INDUSTRIES_COLLAPSED = 12;
const EMPTY_VOCABULARY: MatchVocabulary = { industries: [], certifications: [], naics: {} };

/**
 * One criteria group bound to the shared MatchStore. The Form view stacks all
 * of them; the Guided view shows one at a time with the question as heading.
 */
@Component( {
  selector: 'lv-criteria-group',
  standalone: true,
  imports: [ FormsModule, LocationPickerComponent, NaicsPickerComponent, PillGroupComponent ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="lvm-group" [class.lvm-group--guided]="guided()" [attr.aria-labelledby]="headingId()">
      @if ( guided() ) {
        <h2 class="lvm-question" [id]="headingId()">{{ meta().question }}</h2>
        <p class="lvm-sub">{{ meta().questionHint }}</p>
      } @else {
        <h2 class="lvm-group__title" [id]="headingId()">{{ meta().title }} <span>{{ meta().hint }}</span></h2>
      }

      @switch ( group() ) {
        @case ( 'location' ) {
          <lv-location-picker [location]="criteria().location" [radius]="criteria().radius"
            (locationChange)="setLocation( $event )" (radiusChange)="setRadius( $event )" />
        }
        @case ( 'industry' ) {
          @if ( industryOptions().length ) {
            <lv-pill-group [options]="industryOptions()" [selected]="criteria().industries" ariaLabel="Industry"
              (toggle)="store.toggleIn( 'industries', $event )" />
            @if ( hiddenIndustryCount() ) {
              <button type="button" class="lv-link lvm-more" (click)="showAllIndustries.set( !showAllIndustries() )">
                {{ showAllIndustries() ? 'Show fewer' : 'Show all ' + allIndustryCount() + ' industries' }}
              </button>
            }
          } @else {
            <p class="lvm-hint">Loading industries…</p>
          }
        }
        @case ( 'naics' ) {
          <lv-naics-picker [selected]="criteria().naics" [counts]="vocabulary().naics" [suggestions]="companyNaics()"
            [suggestionLabel]="suggestionLabel()" (add)="store.toggleIn( 'naics', $event )" (remove)="store.toggleIn( 'naics', $event )" />
        }
        @case ( 'certifications' ) {
          @if ( certificationOptions().length ) {
            <lv-pill-group [options]="certificationOptions()" [selected]="criteria().certifications" ariaLabel="Certifications"
              (toggle)="store.toggleIn( 'certifications', $event )" />
          } @else {
            <p class="lvm-hint">Loading certifications…</p>
          }
        }
        @case ( 'keywords' ) {
          <label class="lvm-keywords">
            <span class="lvm-sr">Keywords</span>
            <input class="lv-field" type="text" [ngModel]="criteria().keywords" (ngModelChange)="store.updateCriteria( { keywords: $event } )"
              placeholder="e.g. cloud migration, roofing" autocomplete="off" />
          </label>
        }
      }
    </section>
  `,
} )
export class CriteriaGroupComponent {
  protected readonly store = inject( MatchStore );
  readonly group = input.required<CriteriaGroupId>();
  readonly guided = input( false );

  protected readonly vocabulary = toSignal(
    inject( MatchApiService ).vocabulary().pipe( catchError( () => of( EMPTY_VOCABULARY ) ) ),
    { initialValue: EMPTY_VOCABULARY },
  );
  protected readonly criteria = this.store.criteria;
  protected readonly showAllIndustries = signal( false );

  protected readonly meta = computed( () => CRITERIA_GROUPS.find( ( item ) => item.id === this.group() )! );
  protected readonly headingId = computed( () => `lvm-group-${ this.group() }` );

  protected readonly allIndustryCount = computed( () => this.vocabulary().industries.length );

  /** Top industries by company count, plus anything already picked so it stays visible. */
  protected readonly industryOptions = computed<PillOption[]>( () => {
    const all = this.vocabulary().industries;
    const selected = new Set( this.criteria().industries );
    const visible = this.showAllIndustries() ? all : all.filter( ( entry, index ) => index < INDUSTRIES_COLLAPSED || selected.has( entry.value ) );
    return visible.map( ( entry ) => ( { value: entry.value, label: entry.value, count: entry.count } ) );
  } );

  protected readonly hiddenIndustryCount = computed( () => Math.max( 0, this.allIndustryCount() - INDUSTRIES_COLLAPSED ) );

  protected readonly certificationOptions = computed<PillOption[]>( () =>
    this.vocabulary().certifications.map( ( entry ) => ( { value: entry.value, label: entry.value, count: entry.count } ) ) );

  protected readonly companyNaics = computed( () => this.store.path() === 'match' ? this.store.company()?.naics || [] : [] );
  protected readonly suggestionLabel = computed( () => `From ${ this.store.company()?.name || 'the company' }:` );

  protected setLocation ( location: MatchLocation | null ): void {
    this.store.updateCriteria( location ? { location } : { location: null, radius: null } );
  }

  protected setRadius ( radius: MatchRadius | null ): void {
    this.store.updateCriteria( { radius } );
  }
}
