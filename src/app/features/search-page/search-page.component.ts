import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { LeadVaultAssistantSignalService } from '../../services/lead-vault-assistant-signal.service';
import { LeadVaultApiService } from '../../services/lead-vault-api.service';
import { Observable, from, of } from 'rxjs';
import { catchError, concatMap, map, toArray } from 'rxjs/operators';
import { VERSION } from '../../version';

/**
 * TRIM, not rewrite - the largest component in this extraction (2,143
 * combined lines: 729 TS / 71 HTML / 1,343 CSS in the monorepo original).
 * Read the original in full before deciding. The hypothesis that most of
 * the bulk is real search/filter UI (not feature bloat like Network's
 * list.component.ts, which needed a ground-up rewrite) held up: the HTML
 * is only 71 lines - a mode toggle, one form, a validation result, a
 * results list, and a "no results" recovery-pill state. No AI-search
 * parser UI, no saved-search management, no admin-configurable columns.
 * The 1,343 lines of CSS are styling weight for that small, real UI
 * surface, not evidence of tangential features. So: trimmed, kept nearly
 * everything, with two cuts -
 *
 *  1. ToddAssistantBusService -> LeadVaultAssistantSignalService (a no-op
 *     stub, per the extraction convention - this app doesn't carry TODD's
 *     assistant bus). Call sites are kept as-is rather than deleted, to
 *     minimize the diff against the original.
 *  2. Exit-intent tracking (visibilitychange/beforeunload/pagehide
 *     listeners + sendBeacon to /todd-exit-intent) is CUT entirely. This
 *     is TODD-wide marketing telemetry, not part of Lead Vault's own
 *     search/validate/unlock behavior - about 150 of the 729 TS lines,
 *     none of which affect what the page actually does for a visitor.
 *
 * Everything else ports as-is: validate vs. search modes, the intent-query
 * translation + multi-term fallback search (translateIntentQuery /
 * runFallbackSearches), the momentum-prepared-set deep link
 * (?momentumPreparedSet=...), placeholder rotation, and recovery pills.
 *
 * Route targets shortened for this app: /lead-vault/record/:id -> /record/:id.
 * The header's "TODD Home" link now points at the monorepo's real
 * production domain (https://todd.taliferro.tech, confirmed from the
 * monorepo's own environment.prod.ts PLATFORM_URL) rather than this app's
 * own "/" - "/" here IS the Lead Vault search page itself, so a
 * self-referential "home" link would be confusing.
 */
type LeadVaultSearchResultItem = {
  id: string;
  teaserName: string;
  teaserTitle: string;
  teaserCompanyName: string;
  teaserLocation: string;
  sector: string;
  capabilities: string[];
  emailMasked: string;
  qualityScore: number;
};

type LeadVaultMode = 'validate' | 'search';

@Component( {
  selector: 'app-search-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './search-page.component.html',
  styleUrl: './search-page.component.css'
} )
export class SearchPageComponent implements OnInit, OnDestroy {
  /** The monorepo's real production domain - see header comment. */
  readonly toddHomeUrl = 'https://todd.taliferro.tech';
  readonly appVersion = VERSION;

  readonly placeholderExamples: string[] = [
    'Who is looking to buy technology services',
    'I sell perfume and I\'m looking for leads',
    'Real estate investors',
    'Who buys cloud services in Seattle',
    'Companies needing cybersecurity',
    'Healthcare companies in Seattle',
    'Who buys houses',
    'Manufacturers needing logistics',
  ];
  readonly predefinedRecoveryPills: string[] = [
    'Supplier diversity leaders',
    'Companies hiring subcontractors',
    'Cloud services buyers',
    'Government contractors',
    'Staffing and recruiting buyers',
    'Real estate developers',
    'Mortgage lenders',
    'Home builders',
  ];
  placeholderText = this.placeholderExamples[0];
  private placeholderIndex = 0;
  private placeholderIntervalId: ReturnType<typeof setInterval> | null = null;
  private hasAutoSearchedFromQueryParam = false;

  searchQuery = '';
  mode: LeadVaultMode = 'validate';
  isLoading = false;
  hasSearched = false;
  errorMessage = '';
  results: LeadVaultSearchResultItem[] = [];
  translatedQueryTerms: string[] = [];
  fallbackSearchTermsTried: string[] = [];
  showingTranslatedResults = false;
  preparedSetId = '';
  preparedSetStatus = '';
  preparedSetCandidateCount = 0;
  preparedSetMessage = '';
  validationResult: {
    verdict: string;
    score: number;
    matched: boolean;
    record?: LeadVaultSearchResultItem | null;
  } | null = null;

  constructor (
    private readonly leadVaultService: LeadVaultApiService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly assistantBus: LeadVaultAssistantSignalService,
  ) { }

  ngOnInit (): void {
    this.route.queryParamMap.subscribe( ( params ) => {
      const preparedSetId = ( params.get( 'momentumPreparedSet' ) || '' ).trim();
      const queryFromUrl = ( params.get( 'query' ) || '' ).trim();

      if ( preparedSetId ) {
        this.preparedSetId = preparedSetId;
        this.loadMomentumPreparedSet( preparedSetId );
        return;
      }

      this.preparedSetId = '';
      this.preparedSetStatus = '';
      this.preparedSetCandidateCount = 0;
      this.preparedSetMessage = '';

      if ( !queryFromUrl ) {
        this.hasAutoSearchedFromQueryParam = false;
        this.publishPageContext();
        return;
      }

      this.mode = 'search';
      this.searchQuery = queryFromUrl;
      this.stopPlaceholderRotation();
      this.publishPageContext();

      if ( this.hasAutoSearchedFromQueryParam ) return;

      this.hasAutoSearchedFromQueryParam = true;
      setTimeout( () => this.search( 'query-param' ), 0 );
    } );

    this.publishPageContext();
    setTimeout( () => {
      this.startPlaceholderRotation();
    }, 300 );
  }

  ngOnDestroy (): void {
    this.stopPlaceholderRotation();
    this.assistantBus.clearPageContext();
  }

  private publishPageContext (): void {
    const trimmedQuery = ( this.searchQuery || '' ).trim();

    this.assistantBus.setPageContext( {
      feature: 'lead-vault',
      page: 'lead-vault-search',
      route: this.router.url,
      mode: 'search',
      title: 'Lead Vault Search',
      description: 'Search curated and enriched business contacts by company, sector, capability, or buying signal.',
      allowedActions: [
        'search_leads',
        'refine_search',
        'review_results',
        'open_lead',
        'clear_search'
      ],
      selectedEntityType: 'lead_search',
      selectedEntityId: '',
      summary: {
        hasQuery: !!trimmedQuery,
        queryLength: trimmedQuery.length,
        hasSearched: this.hasSearched,
        isLoading: this.isLoading,
        resultCount: this.results.length,
        hasError: !!this.errorMessage,
        showingTranslatedResults: this.showingTranslatedResults,
        preparedSetId: this.preparedSetId,
        preparedSetStatus: this.preparedSetStatus,
        preparedSetCandidateCount: this.preparedSetCandidateCount
      },
      dataPreview: {
        query: trimmedQuery,
        errorMessage: this.errorMessage,
        preparedSetMessage: this.preparedSetMessage,
        translatedQueryTerms: this.translatedQueryTerms,
        fallbackSearchTermsTried: this.fallbackSearchTermsTried,
        topResults: this.results.slice( 0, 3 ).map( result => ( {
          id: result.id,
          teaserName: result.teaserName,
          teaserTitle: result.teaserTitle,
          teaserCompanyName: result.teaserCompanyName,
          teaserLocation: result.teaserLocation,
          sector: result.sector,
          qualityScore: result.qualityScore
        } ) )
      }
    } );
  }

  private loadMomentumPreparedSet ( setId: string ): void {
    this.isLoading = true;
    this.hasSearched = true;
    this.errorMessage = '';
    this.results = [];
    this.searchQuery = '';
    this.clearFallbackState();
    this.emitAssistantActivity( 'lead_search_prepared_set_opened', { setId } );
    this.publishPageContext();

    this.leadVaultService.getMomentumPreparedSet( setId ).subscribe( {
      next: ( response ) => {
        const preparedSet = response?.data || {} as any;
        const candidates = Array.isArray( preparedSet?.candidates ) ? preparedSet.candidates : [];
        this.preparedSetStatus = String( preparedSet?.status || '' ).trim();
        this.preparedSetCandidateCount = Number( preparedSet?.candidateCount || candidates.length || 0 );
        this.preparedSetMessage = this.preparedSetCandidateCount > 0
          ? `TODD staged ${this.preparedSetCandidateCount} lead candidate${this.preparedSetCandidateCount === 1 ? '' : 's'} for this momentum push.`
          : 'TODD did not find enough qualified leads to stage automatically.';
        this.results = this.normalizeResults( candidates.map( ( candidate: any ) => ( {
          id: String( candidate?.recordId || candidate?.id || '' ).trim(),
          teaserName: String( candidate?.teaserName || '' ).trim(),
          teaserTitle: String( candidate?.teaserTitle || '' ).trim(),
          teaserCompanyName: String( candidate?.teaserCompanyName || '' ).trim(),
          teaserLocation: String( candidate?.teaserLocation || '' ).trim(),
          sector: String( candidate?.sector || '' ).trim(),
          capabilities: Array.isArray( candidate?.capabilities ) ? candidate.capabilities : [],
          emailMasked: String( candidate?.emailMasked || '' ).trim(),
          qualityScore: Number( candidate?.qualityScore || 0 )
        } ) ) );
        this.isLoading = false;
        this.publishPageContext();
      },
      error: ( error ) => {
        this.isLoading = false;
        this.preparedSetStatus = 'error';
        this.preparedSetCandidateCount = 0;
        this.preparedSetMessage = '';
        this.errorMessage = error?.error?.message || error?.message || 'TODD could not load the prepared lead set.';
        this.publishPageContext();
      }
    } );
  }

  private emitAssistantActivity ( action: string, meta?: Record<string, any> ): void {
    const trimmedQuery = ( this.searchQuery || '' ).trim();

    this.assistantBus.emitAssistantActivity( {
      feature: 'lead-vault',
      page: 'lead-vault-search',
      route: this.router.url,
      mode: 'search',
      action,
      summary: {
        hasQuery: !!trimmedQuery,
        queryLength: trimmedQuery.length,
        hasSearched: this.hasSearched,
        isLoading: this.isLoading,
        resultCount: this.results.length,
        hasError: !!this.errorMessage,
        showingTranslatedResults: this.showingTranslatedResults
      },
      meta
    } );
  }

  get recoveryPills (): string[] {
    return this.mergeUniqueQueries( this.translatedQueryTerms, this.predefinedRecoveryPills );
  }

  get showRecoveryState (): boolean {
    return this.hasSearched && !this.isLoading && !this.errorMessage && this.results.length === 0;
  }

  private startPlaceholderRotation (): void {
    if ( this.placeholderIntervalId || this.searchQuery.trim() ) return;

    this.placeholderIntervalId = setInterval( () => {
      if ( this.searchQuery.trim() ) {
        this.stopPlaceholderRotation();
        return;
      }

      this.placeholderIndex = ( this.placeholderIndex + 1 ) % this.placeholderExamples.length;
      this.placeholderText = this.placeholderExamples[this.placeholderIndex];
    }, 3000 );
  }

  private stopPlaceholderRotation (): void {
    if ( this.placeholderIntervalId ) {
      clearInterval( this.placeholderIntervalId );
      this.placeholderIntervalId = null;
    }
  }

  onSearchQueryChange (): void {
    this.clearFallbackState();

    if ( this.searchQuery.trim() ) {
      this.stopPlaceholderRotation();
      this.publishPageContext();
      return;
    }

    this.hasAutoSearchedFromQueryParam = false;
    this.startPlaceholderRotation();
    this.publishPageContext();
  }

  onModeChange ( mode: LeadVaultMode ): void {
    this.mode = mode;
    this.hasSearched = false;
    this.errorMessage = '';
    this.results = [];
    this.validationResult = null;
    this.isLoading = false;
    this.clearFallbackState();
    this.publishPageContext();
  }

  submitPrimary (): void {
    if ( this.mode === 'validate' ) {
      this.validateEmail();
      return;
    }
    this.search();
  }

  validateEmail (): void {
    const email = ( this.searchQuery || '' ).trim().toLowerCase();
    this.hasSearched = true;
    this.errorMessage = '';
    this.validationResult = null;
    this.results = [];

    if ( !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test( email ) ) {
      this.errorMessage = 'Enter a complete email address.';
      return;
    }

    this.isLoading = true;
    this.leadVaultService.validateEmail( email ).subscribe( {
      next: ( response ) => {
        this.validationResult = {
          verdict: String( response?.verdict || 'Invalid' ),
          score: Math.round( Number( response?.score || 0 ) * 100 ),
          matched: !!response?.matched,
          record: response?.record ? this.normalizeResults( [response.record] )[0] : null
        };
        this.isLoading = false;
        this.publishPageContext();
      },
      error: ( error ) => {
        this.isLoading = false;
        this.errorMessage = error?.error?.message || error?.message || 'Email validation failed.';
        this.publishPageContext();
      }
    } );
  }

  get validationState (): 'valid' | 'risky' | 'invalid' {
    const verdict = ( this.validationResult?.verdict || '' ).toLowerCase();
    if ( verdict === 'valid' ) return 'valid';
    if ( verdict === 'risky' ) return 'risky';
    return 'invalid';
  }

  get validationIcon (): string {
    if ( this.validationState === 'valid' ) return '✓';
    if ( this.validationState === 'risky' ) return '!';
    return '×';
  }

  get validationLabel (): string {
    if ( this.validationState === 'valid' ) return 'Email appears valid';
    if ( this.validationState === 'risky' ) return 'Email may be risky';
    return 'Email is not deliverable';
  }

  unlockValidationRecord ( record: LeadVaultSearchResultItem ): void {
    const email = ( this.searchQuery || '' ).trim().toLowerCase();
    if ( typeof localStorage !== 'undefined' && email ) {
      localStorage.setItem( 'leadVaultEmail', email );
    }
    this.router.navigate( ['/record', record.id], {
      queryParams: { email }
    } );
  }
  search ( source: 'manual' | 'query-param' | 'recovery-pill' = 'manual' ): void {
    const query = ( this.searchQuery || '' ).trim();

    this.stopPlaceholderRotation();
    this.hasSearched = true;
    this.errorMessage = '';
    this.clearFallbackState();
    this.emitAssistantActivity( 'lead_search_started', { originalQuery: query, source } );
    this.publishPageContext();

    if ( !query ) {
      this.results = [];
      this.errorMessage = 'Enter a company, sector, capability, or search phrase.';
      this.publishPageContext();
      this.emitAssistantActivity( 'lead_search_blocked_empty_query' );
      return;
    }

    this.isLoading = true;
    this.publishPageContext();

    this.leadVaultService.search( { query } ).subscribe( {
      next: ( response ) => {
        const directResults = this.normalizeResults( response?.results );
        const translatedTerms = this.translateIntentQuery( query );
        const directSearchReturnedResults = directResults.length > 0;

        this.emitAssistantActivity( 'lead_search_direct_evaluated', {
          originalQuery: query,
          directQuery: query,
          directResultCount: directResults.length,
          directSearchReturnedResults,
          translatedQueryTerms: translatedTerms
        } );

        if ( directSearchReturnedResults || translatedTerms.length === 0 ) {
          this.fallbackSearchTermsTried = translatedTerms;
          this.finishSearch( {
            originalQuery: query,
            source,
            results: directResults,
            translatedTerms,
            directSearchReturnedResults,
            fallbackSearchReturnedResults: false,
            usedTranslatedResults: false
          } );
          return;
        }

        this.translatedQueryTerms = translatedTerms;
        this.fallbackSearchTermsTried = translatedTerms;
        this.emitAssistantActivity( 'lead_search_fallback_started', {
          originalQuery: query,
          translatedQueryTerms: translatedTerms
        } );

        this.runFallbackSearches( translatedTerms ).subscribe( fallbackResults => {
          this.finishSearch( {
            originalQuery: query,
            source,
            results: fallbackResults,
            translatedTerms,
            directSearchReturnedResults,
            fallbackSearchReturnedResults: fallbackResults.length > 0,
            usedTranslatedResults: fallbackResults.length > 0
          } );
        } );
      },
      error: ( error ) => {
        this.results = [];
        this.clearFallbackState();
        this.isLoading = false;
        this.errorMessage =
          error?.error?.message ||
          error?.message ||
          'Lead Vault search failed.';
        this.publishPageContext();
        this.emitAssistantActivity( 'lead_search_failed', {
          query,
          errorMessage: this.errorMessage
        } );
      }
    } );
  }

  onRecoveryPillClick ( pill: string ): void {
    const previousQuery = ( this.searchQuery || '' ).trim();

    this.searchQuery = pill;
    this.stopPlaceholderRotation();
    this.emitAssistantActivity( 'lead_search_recovery_pill_clicked', {
      originalQuery: previousQuery,
      recoveryPill: pill
    } );
    this.search( 'recovery-pill' );
  }

  trackByResultId ( index: number, item: { id: string; } ): string {
    return item.id;
  }

  private clearFallbackState (): void {
    this.translatedQueryTerms = [];
    this.fallbackSearchTermsTried = [];
    this.showingTranslatedResults = false;
  }

  private normalizeResults ( results: unknown ): LeadVaultSearchResultItem[] {
    return Array.isArray( results ) ? results as LeadVaultSearchResultItem[] : [];
  }

  private runFallbackSearches ( translatedTerms: string[] ): Observable<LeadVaultSearchResultItem[]> {
    return from( translatedTerms ).pipe(
      concatMap( translatedQuery =>
        this.leadVaultService.search( { query: translatedQuery } ).pipe(
          map( response => this.normalizeResults( response?.results ) ),
          catchError( () => {
            this.emitAssistantActivity( 'lead_search_fallback_term_failed', {
              translatedQuery
            } );

            return of( [] as LeadVaultSearchResultItem[] );
          } )
        )
      ),
      toArray(),
      map( resultsByTerm => {
        const seenIds = new Set<string>();

        return resultsByTerm.flat().filter( result => {
          if ( !result?.id || seenIds.has( result.id ) ) {
            return false;
          }

          seenIds.add( result.id );
          return true;
        } );
      } )
    );
  }

  private finishSearch ( details: {
    originalQuery: string;
    source: 'manual' | 'query-param' | 'recovery-pill';
    results: LeadVaultSearchResultItem[];
    translatedTerms: string[];
    directSearchReturnedResults: boolean;
    fallbackSearchReturnedResults: boolean;
    usedTranslatedResults: boolean;
  } ): void {
    this.results = details.results;
    this.translatedQueryTerms = details.translatedTerms;
    this.showingTranslatedResults = details.usedTranslatedResults;
    this.isLoading = false;
    this.publishPageContext();
    this.emitAssistantActivity( 'lead_search_completed', {
      originalQuery: details.originalQuery,
      source: details.source,
      translatedQueryTerms: details.translatedTerms,
      directSearchReturnedResults: details.directSearchReturnedResults,
      fallbackSearchReturnedResults: details.fallbackSearchReturnedResults,
      usedTranslatedResults: details.usedTranslatedResults,
      resultCount: this.results.length,
      topResultIds: this.results.slice( 0, 5 ).map( result => result.id )
    } );
  }

  private mergeUniqueQueries ( ...queryGroups: string[][] ): string[] {
    const seen = new Set<string>();

    return queryGroups
      .flat()
      .filter( query => {
        const normalizedQuery = ( query || '' ).trim().toLowerCase();
        if ( !normalizedQuery || seen.has( normalizedQuery ) ) {
          return false;
        }

        seen.add( normalizedQuery );
        return true;
      } );
  }

  private translateIntentQuery ( query: string ): string[] {
    const normalizedQuery = query.toLowerCase().replace( /[^a-z0-9\s]/g, ' ' );
    const translatedTerms: string[] = [];
    const broadIntentPattern = /\b(i work in|i sell|i am|i'm|looking for|interested in|people who|companies that|who buys|who is buying|buyers|buying|need|needs|needing|seeking|wants?|searching for)\b/;

    const matchesAny = ( patterns: RegExp[] ): boolean => patterns.some( pattern => pattern.test( normalizedQuery ) );

    if ( matchesAny( [/\bsupplier diversity\b/, /\bdiverse supplier/, /\bminority[- ]owned\b/, /\bwomen[- ]owned\b/, /\bveteran[- ]owned\b/, /\b8a\b/, /\bhubzone\b/] ) ) {
      translatedTerms.push( 'Supplier diversity leaders', 'Government contractors', 'Companies hiring subcontractors' );
    }

    if ( matchesAny( [/\bsubcontract/, /\bsub contractor/, /\bvendor\b/, /\bteaming\b/, /\bprime contractor/, /\boutsourc/] ) ) {
      translatedTerms.push( 'Companies hiring subcontractors', 'Government contractors', 'Supplier diversity leaders' );
    }

    if ( matchesAny( [/\bcloud\b/, /\baws\b/, /\bazure\b/, /\bgcp\b/, /\bgoogle cloud\b/, /\bcloud migration\b/, /\bcloud modernization\b/] ) ) {
      translatedTerms.push( 'Cloud services buyers' );
    }

    if ( matchesAny( [/\bgovernment\b/, /\bfederal\b/, /\bstate agency\b/, /\bmunicipal\b/, /\bpublic sector\b/, /\brfp\b/, /\bprocurement\b/, /\bcontract vehicle\b/] ) ) {
      translatedTerms.push( 'Government contractors', 'Companies hiring subcontractors' );
    }

    if ( matchesAny( [/\bstaffing\b/, /\brecruiting\b/, /\brecruitment\b/, /\bhiring\b/, /\btalent acquisition\b/, /\btemp\b/, /\bworkforce\b/] ) ) {
      translatedTerms.push( 'Staffing and recruiting buyers' );
    }

    if ( matchesAny( [/\breal estate\b/, /\bhouse\b/, /\bhouses\b/, /\bhome\b/, /\bhousing\b/, /\bmortgage\b/, /\bproperty\b/, /\bhomebuyer\b/, /\bresidential\b/] ) ) {
      translatedTerms.push( 'Real estate developers', 'Mortgage lenders', 'Home builders', 'Residential property management' );
    }

    if ( matchesAny( [/\bdeveloper\b/, /\bdevelopment\b/, /\bmulti family\b/, /\bmultifamily\b/] ) ) {
      translatedTerms.push( 'Real estate developers', 'Residential property management' );
    }

    if ( translatedTerms.length === 0 && broadIntentPattern.test( normalizedQuery ) ) {
      if ( /\bcontractor\b/.test( normalizedQuery ) ) {
        translatedTerms.push( 'Government contractors', 'Companies hiring subcontractors' );
      }

      if ( /\bservice\b|\bservices\b|\btechnology\b|\bit\b|\bsoftware\b/.test( normalizedQuery ) ) {
        translatedTerms.push( 'Cloud services buyers' );
      }
    }

    return this.mergeUniqueQueries( translatedTerms );
  }
}
