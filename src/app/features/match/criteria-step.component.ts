import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { CRITERIA_GROUPS, CriteriaGroupComponent, CriteriaGroupId } from './controls/criteria-group.component';
import { MatchStore } from './match-store.service';
import { MatchCriteria } from './match.models';

interface RecoveryAction {
  label: string;
  patch: Partial<MatchCriteria>;
}

/**
 * Criteria step in either layout. Both views edit the same MatchStore state,
 * so flipping the Form/Guided toggle never loses a selection.
 */
@Component( {
  selector: 'lv-criteria-step',
  standalone: true,
  imports: [ CriteriaGroupComponent, NgTemplateOutlet, RouterLink ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if ( store.view() === 'form' ) {
      <!-- 5b: every group, with the live summary and count in a sticky rail -->
      <main class="lvm-page lvm-form">
        <div class="lvm-form__main">
          <div>
            <h1 class="lvm-title">{{ title() }}</h1>
            <p class="lvm-sub">Pick what matters. Leave a group empty and it won’t filter anything.</p>
          </div>
          @for ( group of groups; track group.id ) {
            <lv-criteria-group [group]="group.id" />
          }
        </div>

        <aside class="lvm-rail">
          <ng-container *ngTemplateOutlet="companyCard" />
          <section class="lvm-card">
            <p class="lv-eyebrow">Your criteria</p>
            @if ( store.criteriaSummary().length ) {
              <div class="lvm-summary">
                @for ( part of store.criteriaSummary(); track part ) { <span>{{ part }}</span> }
              </div>
            } @else {
              <p class="lvm-hint">Nothing picked yet, so every company counts.</p>
            }
          </section>
          <ng-container *ngTemplateOutlet="countCard" />
        </aside>
      </main>
    } @else {
      <!-- 5d: one question at a time; each answer fills in the sentence -->
      <main class="lvm-page lvm-guided">
        <div class="lvm-progress" aria-hidden="true">
          @for ( dot of progressDots(); track $index ) { <i [class.is-on]="dot"></i> }
        </div>

        @if ( store.path() === 'match' && store.company(); as company ) {
          <p class="lvm-for"><span class="lvm-avatar lvm-avatar--sm">{{ store.companyInitials() }}</span> Matching for {{ company.name }}</p>
        }

        <p class="lvm-sentence">
          Find companies
          @for ( piece of sentence(); track piece.id ) {
            @if ( piece.text ) {
              {{ piece.lead }} <button type="button" class="lvm-sentence__chip" [class.is-current]="piece.id === currentGroup()" (click)="goTo( piece.id )">{{ piece.text }}</button>
            }
          }
        </p>

        <lv-criteria-group [group]="currentGroup()" [guided]="true" />

        <footer class="lvm-guided__footer">
          <button type="button" class="lv-btn" (click)="previous()">
            <svg class="lv-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Back
          </button>
          <button type="button" class="lv-link" (click)="next()">Skip</button>
          <span class="lvm-guided__count">
            @if ( store.liveCount() !== null ) { <b>{{ countLabel() }}</b> match so far } @else { Counting… }
          </span>
          <button type="button" class="lv-btn lvm-btn--blue" [disabled]="isLastGroup() && !canSeeMatches()" (click)="next()">
            {{ nextLabel() }}
            <svg class="lv-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
        </footer>
        <ng-container *ngTemplateOutlet="recovery" />
      </main>
    }

    <!-- 5f: on phones the rail is replaced by one sticky button -->
    <div class="lvm-phone-cta">
      <button type="button" class="lv-btn lvm-btn--blue" [disabled]="!canSeeMatches()" (click)="seeMatches()">{{ phoneCtaLabel() }}</button>
    </div>

    <ng-template #companyCard>
      <section class="lvm-card">
        @if ( store.path() === 'match' && store.company(); as company ) {
          <p class="lv-eyebrow">Matching for</p>
          <div class="lvm-company">
            <span class="lvm-avatar">{{ store.companyInitials() }}</span>
            <div><b>{{ company.name }}</b>@if ( store.companyDomain() ) { <small>{{ store.companyDomain() }}</small> }</div>
          </div>
          @if ( company.description ) { <p class="lvm-company__about">{{ company.description }}</p> }
          <a class="lvm-link" routerLink="/match/company">Change company</a>
        } @else {
          <p class="lv-eyebrow">Criteria only</p>
          <p class="lvm-hint">The AI picks the company that best fits these criteria.</p>
          <a class="lvm-link" routerLink="/match/company">+ Match against a company</a>
        }
      </section>
    </ng-template>

    <ng-template #countCard>
      <section class="lvm-card lvm-count" aria-live="polite">
        <p><b>{{ countLabel() }}</b> {{ countNoun() }}</p>
        <button type="button" class="lv-btn lvm-btn--blue" [disabled]="!canSeeMatches()" (click)="seeMatches()">
          See matches
          <svg class="lv-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </button>
      </section>
      <ng-container *ngTemplateOutlet="recovery" />
    </ng-template>

    <ng-template #recovery>
      @if ( recoveryActions().length ) {
        <section class="lvm-card lvm-recovery">
          <p>No companies match all of these. Try:</p>
          <div class="lvm-pills">
            @for ( action of recoveryActions(); track action.label ) {
              <button type="button" class="lvm-pill" (click)="store.updateCriteria( action.patch )">{{ action.label }}</button>
            }
          </div>
        </section>
      }
    </ng-template>
  `,
} )
export class CriteriaStepComponent {
  protected readonly store = inject( MatchStore );
  private readonly router = inject( Router );

  protected readonly groups = CRITERIA_GROUPS;
  private readonly groupIndex = signal( 0 );

  protected readonly title = computed( () =>
    this.store.path() === 'match' ? 'What should a partner look like?' : 'What are you looking for?' );

  protected readonly countLabel = computed( () => {
    const count = this.store.liveCount();
    return count === null ? ( this.store.countState().status === 'error' ? '—' : '…' ) : count.toLocaleString();
  } );
  protected readonly countNoun = computed( () => this.store.liveCount() === 1 ? 'company matches' : 'companies match' );
  protected readonly canSeeMatches = computed( () => ( this.store.liveCount() ?? 0 ) > 0 );
  protected readonly phoneCtaLabel = computed( () => {
    const count = this.store.liveCount();
    return count === null ? 'Counting…' : count === 0 ? 'No matches yet' : `See ${ count.toLocaleString() } matches`;
  } );

  /** Ways out of a zero count: widen the radius or drop one group at a time. */
  protected readonly recoveryActions = computed<RecoveryAction[]>( () => {
    if ( this.store.liveCount() !== 0 ) return [];
    const criteria = this.store.criteria();
    const actions: RecoveryAction[] = [];
    if ( criteria.location && criteria.radius && criteria.radius < 100 ) actions.push( { label: 'Widen to 100 mi', patch: { radius: 100 } } );
    if ( criteria.location && criteria.radius ) actions.push( { label: 'Anywhere', patch: { radius: null } } );
    if ( criteria.certifications.length ) actions.push( { label: 'Any certification', patch: { certifications: [] } } );
    if ( criteria.industries.length ) actions.push( { label: 'Any industry', patch: { industries: [] } } );
    if ( criteria.naics.length ) actions.push( { label: 'Any NAICS code', patch: { naics: [] } } );
    if ( criteria.keywords.trim() ) actions.push( { label: 'No keywords', patch: { keywords: '' } } );
    return actions;
  } );

  protected readonly currentGroup = computed<CriteriaGroupId>( () => this.groups[ this.groupIndex() ].id );
  protected readonly isLastGroup = computed( () => this.groupIndex() === this.groups.length - 1 );
  protected readonly progressDots = computed( () => this.groups.map( ( _group, index ) => index <= this.groupIndex() ) );
  protected readonly nextLabel = computed( () =>
    this.isLastGroup() ? 'See matches' : `Next: ${ this.groups[ this.groupIndex() + 1 ].title }` );

  /** "Find companies within 50 mi of Austin, TX in Building Construction with NAICS 236220…" */
  protected readonly sentence = computed( () => {
    const criteria = this.store.criteria();
    const keywords = criteria.keywords.split( ',' ).map( ( phrase ) => phrase.trim() ).filter( Boolean );
    return [
      { id: 'location' as const, lead: '', text: criteria.location && criteria.radius ? `within ${ criteria.radius } mi of ${ criteria.location.label }` : 'anywhere' },
      { id: 'industry' as const, lead: 'in', text: criteria.industries.join( ', ' ) || 'any industry' },
      { id: 'naics' as const, lead: 'with', text: criteria.naics.length ? `NAICS ${ criteria.naics.join( ', ' ) }` : 'any NAICS code' },
      { id: 'certifications' as const, lead: 'holding', text: criteria.certifications.join( ', ' ) || 'any certification' },
      { id: 'keywords' as const, lead: keywords.length ? 'mentioning' : '', text: keywords.map( ( phrase ) => `“${ phrase }”` ).join( ', ' ) },
    ];
  } );

  protected goTo ( id: CriteriaGroupId ): void {
    this.groupIndex.set( this.groups.findIndex( ( group ) => group.id === id ) );
  }

  protected next (): void {
    if ( this.isLastGroup() ) {
      this.seeMatches();
      return;
    }
    this.groupIndex.update( ( index ) => index + 1 );
  }

  protected previous (): void {
    if ( this.groupIndex() > 0 ) {
      this.groupIndex.update( ( index ) => index - 1 );
      return;
    }
    this.router.navigate( [ this.store.path() === 'match' ? '/match/company' : '/' ] );
  }

  protected seeMatches (): void {
    if ( !this.canSeeMatches() ) return;
    this.router.navigate( [ '/match/results' ] );
  }
}
