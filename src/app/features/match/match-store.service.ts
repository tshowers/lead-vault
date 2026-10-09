import { DestroyRef, Injectable, Injector, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, distinctUntilChanged, map, of, startWith, switchMap } from 'rxjs';
import { MatchApiService } from './match-api.service';
import {
  BestMatch,
  CriteriaView,
  EMPTY_CRITERIA,
  MatchCompany,
  MatchCriteria,
  MatchPath,
  MatchResult,
} from './match.models';

const STATE_KEY = 'lv-match-state-v1';
const VIEW_KEY = 'lv-match-view';
const COUNT_DEBOUNCE_MS = 300;

interface PersistedState {
  path: MatchPath;
  company: MatchCompany | null;
  criteria: MatchCriteria;
}

export type CountState = { status: 'loading' } | { status: 'ready'; count: number } | { status: 'error' };
export type BestState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; best: BestMatch | null }
  | { status: 'signed-out' }
  | { status: 'error' };

function readStorage<T> ( storage: 'session' | 'local', key: string ): T | null {
  try {
    const raw = ( storage === 'session' ? sessionStorage : localStorage ).getItem( key );
    return raw ? JSON.parse( raw ) as T : null;
  } catch {
    return null;
  }
}

function writeStorage ( storage: 'session' | 'local', key: string, value: unknown ): void {
  try {
    ( storage === 'session' ? sessionStorage : localStorage ).setItem( key, JSON.stringify( value ) );
  } catch {
    // Private mode or blocked storage: the flow still works, it just won't survive a reload.
  }
}

/**
 * One state for the whole match flow, shared by the company, criteria (both
 * views) and results screens. Kept in sessionStorage so "Edit criteria", a
 * sign-in round trip and the Stripe unlock redirect all come back to the same
 * place. The Form/Guided choice is a per-viewer preference in localStorage.
 */
@Injectable( { providedIn: 'root' } )
export class MatchStore {
  private readonly api = inject( MatchApiService );
  private readonly injector = inject( Injector );
  private readonly destroyRef = inject( DestroyRef );

  readonly path = signal<MatchPath>( 'criteria' );
  readonly company = signal<MatchCompany | null>( null );
  readonly criteria = signal<MatchCriteria>( { ...EMPTY_CRITERIA } );
  readonly view = signal<CriteriaView>( 'form' );

  readonly results = signal<MatchResult[]>( [] );
  readonly total = signal( 0 );
  readonly hasMore = signal( false );
  readonly resultsLoading = signal( false );
  readonly resultsError = signal( false );
  /** The criteria the current results were fetched for, to know when they are stale. */
  private readonly resultsKey = signal( '' );

  readonly best = signal<BestState>( { status: 'idle' } );

  /** Live match count, debounced so pill clicks don't each fire a request. */
  readonly countState = signal<CountState>( { status: 'loading' } );
  readonly liveCount = computed( () => {
    const state = this.countState();
    return state.status === 'ready' ? state.count : null;
  } );

  readonly criteriaKey = computed( () => JSON.stringify( this.criteria() ) );
  readonly resultsAreCurrent = computed( () => this.resultsKey() === this.criteriaKey() );

  readonly hasAnyCriteria = computed( () => {
    const criteria = this.criteria();
    return !!( ( criteria.location && criteria.radius ) || criteria.industries.length || criteria.naics.length ||
      criteria.certifications.length || criteria.keywords.trim() );
  } );

  /** Short phrases describing the active criteria, for the rail chips and results header. */
  readonly criteriaSummary = computed( () => {
    const criteria = this.criteria();
    const parts: string[] = [];
    if ( criteria.location && criteria.radius ) parts.push( `Within ${ criteria.radius } mi of ${ criteria.location.label }` );
    if ( criteria.industries.length ) parts.push( criteria.industries.join( ', ' ) );
    if ( criteria.certifications.length ) parts.push( criteria.certifications.join( ', ' ) );
    if ( criteria.naics.length ) parts.push( `NAICS ${ criteria.naics.join( ', ' ) }` );
    criteria.keywords.split( ',' ).map( ( phrase ) => phrase.trim() ).filter( Boolean )
      .forEach( ( phrase ) => parts.push( `“${ phrase }”` ) );
    return parts;
  } );

  /** Company domain for display ("northwindfederal.com"). */
  readonly companyDomain = computed( () => {
    const url = this.company()?.url || '';
    try {
      return url ? new URL( /^https?:\/\//i.test( url ) ? url : `https://${ url }` ).hostname.replace( /^www\./, '' ) : '';
    } catch {
      return url;
    }
  } );

  readonly companyInitials = computed( () => ( this.company()?.name || '' )
    .split( /\s+/ ).filter( Boolean ).slice( 0, 2 ).map( ( word ) => word[ 0 ].toUpperCase() ).join( '' ) );

  constructor () {
    if ( typeof window === 'undefined' ) return;

    const saved = readStorage<PersistedState>( 'session', STATE_KEY );
    if ( saved ) {
      this.path.set( saved.path === 'match' ? 'match' : 'criteria' );
      this.company.set( saved.company || null );
      this.criteria.set( { ...EMPTY_CRITERIA, ...saved.criteria } );
    }
    const savedView = readStorage<CriteriaView>( 'local', VIEW_KEY );
    if ( savedView === 'guided' || savedView === 'form' ) this.view.set( savedView );

    effect( () => {
      writeStorage( 'session', STATE_KEY, {
        path: this.path(),
        company: this.company(),
        criteria: this.criteria(),
      } satisfies PersistedState );
    } );
    effect( () => writeStorage( 'local', VIEW_KEY, this.view() ) );
  }

  private counting = false;

  /**
   * Start the live count. Called by the match shell rather than the
   * constructor, so the home page (which injects the store for its entry
   * cards) doesn't send a count request on every visit.
   */
  startLiveCount (): void {
    if ( this.counting || typeof window === 'undefined' ) return;
    this.counting = true;

    toObservable( this.criteriaKey, { injector: this.injector } ).pipe(
      distinctUntilChanged(),
      debounceTime( COUNT_DEBOUNCE_MS ),
      switchMap( () => this.api.count( this.criteria() ).pipe(
        map( ( count ): CountState => ( { status: 'ready', count } ) ),
        catchError( () => of<CountState>( { status: 'error' } ) ),
        startWith<CountState>( { status: 'loading' } ),
      ) ),
      takeUntilDestroyed( this.destroyRef ),
    ).subscribe( ( state ) => this.countState.set( state ) );
  }

  /** Start a fresh flow from the home page, carrying typed text into Keywords. */
  start ( path: MatchPath, keywords = '' ): void {
    this.path.set( path );
    this.company.set( null );
    this.criteria.set( { ...EMPTY_CRITERIA, keywords: keywords.trim() } );
    this.clearResults();
  }

  updateCriteria ( patch: Partial<MatchCriteria> ): void {
    this.criteria.update( ( criteria ) => ( { ...criteria, ...patch } ) );
  }

  toggleIn ( key: 'industries' | 'naics' | 'certifications', value: string ): void {
    this.criteria.update( ( criteria ) => {
      const list = criteria[ key ];
      return { ...criteria, [ key ]: list.includes( value ) ? list.filter( ( item ) => item !== value ) : [ ...list, value ] };
    } );
  }

  setCompany ( company: MatchCompany ): void {
    this.company.set( company );
    this.path.set( 'match' );
  }

  /** Drop the company and continue on the criteria-only path. */
  useCriteriaOnly (): void {
    this.company.set( null );
    this.path.set( 'criteria' );
  }

  clearResults (): void {
    this.results.set( [] );
    this.total.set( 0 );
    this.hasMore.set( false );
    this.resultsKey.set( '' );
    this.best.set( { status: 'idle' } );
  }

  /** First page of results; the AI pick is requested separately so the list never waits on it. */
  loadResults ( signedIn: boolean ): void {
    const key = this.criteriaKey();
    this.resultsLoading.set( true );
    this.resultsError.set( false );

    this.api.search( this.criteria() ).subscribe( {
      next: ( response ) => {
        this.results.set( response.results );
        this.total.set( response.total );
        this.hasMore.set( response.hasMore );
        this.resultsKey.set( key );
        this.resultsLoading.set( false );
      },
      error: () => {
        this.resultsError.set( true );
        this.resultsLoading.set( false );
      },
    } );

    this.loadBest( signedIn );
  }

  loadMore (): void {
    if ( this.resultsLoading() || !this.hasMore() ) return;
    this.resultsLoading.set( true );
    this.api.search( this.criteria(), this.results().length ).subscribe( {
      next: ( response ) => {
        this.results.update( ( rows ) => [ ...rows, ...response.results ] );
        this.hasMore.set( response.hasMore );
        this.resultsLoading.set( false );
      },
      error: () => this.resultsLoading.set( false ),
    } );
  }

  loadBest ( signedIn: boolean ): void {
    if ( !signedIn ) {
      this.best.set( { status: 'signed-out' } );
      return;
    }
    this.best.set( { status: 'loading' } );
    this.api.best( this.criteria(), this.path() === 'match' ? this.company() : null ).subscribe( {
      next: ( best ) => this.best.set( { status: 'ready', best } ),
      error: () => this.best.set( { status: 'error' } ),
    } );
  }
}
