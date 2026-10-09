import { ChangeDetectionStrategy, Component, computed, effect, inject, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { LeadVaultAuthService } from '../../services/lead-vault-auth.service';
import { LeadVaultViewerService } from '../../services/lead-vault-viewer.service';
import { MatchStore } from './match-store.service';
import { MatchResult } from './match.models';

/**
 * 5e/5g: the AI's single best pick first, then every match ranked by score
 * with what it matched on. The list renders as soon as it arrives; the AI
 * card loads on its own and never holds the list back.
 */
@Component( {
  selector: 'lv-results-step',
  standalone: true,
  imports: [ RouterLink ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="lvm-page lvm-results">
      <header class="lvm-results__head">
        <div>
          <h1 class="lvm-title">{{ title() }}</h1>
          @if ( store.criteriaSummary().length ) {
            <div class="lvm-summary">
              @for ( part of store.criteriaSummary(); track part ) { <span>{{ part }}</span> }
            </div>
          }
        </div>
        <a class="lv-btn" routerLink="/match/criteria" aria-label="Edit criteria">
          <svg class="lv-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M2 14h4M10 8h4M18 16h4"/></svg>
          <span class="lvm-hide-phone">Edit criteria</span>
        </a>
      </header>

      @switch ( bestView().status ) {
        @case ( 'loading' ) {
          <section class="lvm-best" aria-busy="true">
            <span class="lvm-best__tag">✦ AI best match</span>
            <div class="lvm-skeleton lvm-skeleton--title"></div>
            <div class="lvm-skeleton"></div>
            <div class="lvm-skeleton lvm-skeleton--short"></div>
          </section>
        }
        @case ( 'ready' ) {
          @if ( bestView().row; as best ) {
            <section class="lvm-best" aria-live="polite">
              <div class="lvm-best__body">
                <span class="lvm-best__tag">✦ AI best match</span>
                <h2>{{ best.teaserCompanyName }}</h2>
                <p class="lvm-best__meta">{{ best.meta }}</p>
                <p class="lvm-best__reason">{{ bestView().reason }}</p>
                @if ( best.matchReasons.length ) {
                  <div class="lvm-best__chips">@for ( reason of best.matchReasons; track reason ) { <span>{{ reason }}</span> }</div>
                }
              </div>
              <div class="lvm-best__side">
                <span class="lv-ring lvm-ring--lg" [style.--v]="best.score"><span>{{ best.score }}<small>match</small></span></span>
                <a class="lv-btn lvm-btn--blue" [routerLink]="best.unlockLink">Unlock record</a>
              </div>
            </section>
          }
        }
        @case ( 'signed-out' ) {
          <section class="lvm-best lvm-best--prompt">
            <div class="lvm-best__body">
              <span class="lvm-best__tag">✦ AI best match</span>
              <h2>See which one the AI would pick</h2>
              <p class="lvm-best__reason">Sign in with TODD and the AI reads these results and explains its single best pick.</p>
            </div>
            <button type="button" class="lv-btn lvm-btn--blue" (click)="signIn()">Sign in with TODD</button>
          </section>
        }
        @case ( 'error' ) {
          <p class="lvm-hint" role="status">The AI pick isn’t available right now. The ranked list below is unaffected.</p>
        }
      }

      <div class="lvm-results__bar">
        <p><b>{{ totalLabel() }}</b> · sorted by score</p>
        <div class="lvm-results__actions">
          <button type="button" class="lv-btn" [disabled]="!rows().length" (click)="exportOrSignIn()" [attr.aria-label]="exportLabel()">
            <svg class="lv-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            <span class="lvm-hide-phone">{{ exportLabel() }}</span>
          </button>
        </div>
      </div>

      @if ( store.resultsError() ) {
        <section class="lvm-card lvm-recovery">
          <p>We couldn’t load matches.</p>
          <button type="button" class="lv-btn" (click)="reload()">Try again</button>
        </section>
      }

      <ol class="lvm-rows">
        @for ( row of rows(); track row.id ) {
          <li class="lvm-row">
            <span class="lvm-row__rank">{{ row.rank }}</span>
            <div class="lvm-row__who">
              <h3>{{ row.teaserCompanyName }}</h3>
              <p>{{ row.meta }}</p>
            </div>
            <div class="lvm-row__reasons">
              @for ( reason of row.matchReasons; track reason ) { <span>{{ reason }}</span> }
            </div>
            <span class="lv-ring lvm-ring" [style.--v]="row.score" [attr.aria-label]="row.score + ' match'"><span>{{ row.score }}</span></span>
            <a class="lv-btn lvm-row__unlock" [routerLink]="row.unlockLink">{{ row.unlockLabel }}</a>
          </li>
        }
      </ol>

      @if ( store.resultsLoading() && !rows().length ) { <p class="lvm-hint" role="status">Finding matches…</p> }

      @if ( store.hasMore() ) {
        <div class="lvm-more-row">
          <button type="button" class="lv-btn" [disabled]="store.resultsLoading()" (click)="store.loadMore()">
            {{ store.resultsLoading() ? 'Loading…' : 'Show more' }}
          </button>
        </div>
      } @else if ( signedOutAndCapped() ) {
        <div class="lvm-more-row">
          <button type="button" class="lv-btn" (click)="signIn()">Sign in with TODD to see all {{ store.total().toLocaleString() }}</button>
        </div>
      }
    </main>
  `,
} )
export class ResultsStepComponent {
  protected readonly store = inject( MatchStore );
  private readonly router = inject( Router );
  private readonly authService = inject( LeadVaultAuthService );
  private readonly viewer = toSignal( inject( LeadVaultViewerService ).viewer$ );

  private readonly signedIn = computed( () => this.viewer()?.status === 'signed-in' );
  private readonly hasFullAccess = computed( () => !!this.viewer()?.hasFullAccess );

  protected readonly title = computed( () => {
    const company = this.store.company();
    return this.store.path() === 'match' && company ? `Best partners for ${ company.name }` : 'Best matches for your criteria';
  } );

  protected readonly totalLabel = computed( () => {
    const total = this.store.total();
    return `${ total.toLocaleString() } ${ total === 1 ? 'match' : 'matches' }`;
  } );

  /** Anonymous pages stop at the public cap; more exist behind sign-in. */
  protected readonly signedOutAndCapped = computed( () =>
    !this.signedIn() && this.store.total() > this.store.results().length );

  protected readonly rows = computed( () => this.store.results().map( ( result, index ) => this.toRow( result, index + 1 ) ) );

  protected readonly bestView = computed( () => {
    const state = this.store.best();
    if ( state.status !== 'ready' ) return { status: state.status, row: null, reason: '' };
    return { status: state.status, row: state.best ? this.toRow( state.best, 0 ) : null, reason: state.best?.reason || '' };
  } );

  constructor () {
    // Wait until we know who is viewing: page size and the AI pick depend on it.
    effect( () => {
      const status = this.viewer()?.status;
      if ( !status || status === 'loading' ) return;
      untracked( () => {
        if ( !this.store.resultsAreCurrent() ) {
          this.store.loadResults( status === 'signed-in' );
        } else if ( status === 'signed-in' && this.store.best().status !== 'ready' && this.store.best().status !== 'loading' ) {
          this.store.loadBest( true );
        }
      } );
    } );
  }

  protected reload (): void {
    this.store.loadResults( this.signedIn() );
  }

  protected signIn (): void {
    this.authService.signIn( '/match/results' );
  }

  /** Export is for signed-in users; signing in is free and it's where most people sign up. */
  protected readonly exportLabel = computed( () => this.signedIn() ? 'Export CSV' : 'Sign in to export' );

  protected exportOrSignIn (): void {
    if ( this.signedIn() ) this.exportCsv();
    else this.signIn();
  }

  private exportCsv (): void {
    const header = [ 'Company', 'Contact', 'Title', 'Location', 'Industry', 'Email (masked)', 'Score', 'Matched on', 'Contacts at company', 'Record' ];
    const origin = typeof window === 'undefined' ? '' : window.location.origin;
    const lines = this.store.results().map( ( row ) => [
      row.teaserCompanyName, row.teaserName, row.teaserTitle, row.teaserLocation, row.sector, row.emailMasked,
      String( row.score ), row.matchReasons.join( '; ' ), String( row.contactCount ), `${ origin }/record/${ row.id }`,
    ] );
    const csv = [ header, ...lines ]
      .map( ( cells ) => cells.map( ( cell ) => `"${ String( cell ?? '' ).replace( /"/g, '""' ) }"` ).join( ',' ) )
      .join( '\r\n' );

    const url = URL.createObjectURL( new Blob( [ csv ], { type: 'text/csv;charset=utf-8' } ) );
    const link = Object.assign( document.createElement( 'a' ), { href: url, download: 'lead-vault-matches.csv' } );
    link.click();
    URL.revokeObjectURL( url );
  }

  private toRow ( result: MatchResult, rank: number ) {
    const meta = [
      result.teaserLocation,
      result.distanceMiles !== null ? `${ result.distanceMiles } mi` : '',
      result.teaserName,
      result.teaserTitle,
      result.contactCount > 1 ? `+${ result.contactCount - 1 } more contacts` : '',
    ].filter( Boolean ).join( ' · ' );

    return {
      ...result,
      rank,
      meta,
      // Distance already shows in the meta line; keep the chips to what it matched on.
      matchReasons: result.matchReasons.filter( ( reason ) => !/^\d+ mi$/.test( reason ) ),
      unlockLink: this.hasFullAccess() ? [ '/full', result.id ] : [ '/record', result.id ],
      unlockLabel: this.hasFullAccess() ? 'Open' : 'Unlock',
    };
  }
}
