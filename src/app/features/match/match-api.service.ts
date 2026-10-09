import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  BestMatch,
  MatchCompany,
  MatchCriteria,
  MatchSearchResponse,
  MatchVocabulary,
  NaicsOption,
} from './match.models';

/**
 * Lead Vault Match endpoints (todd-backend leadVaultMatchRoutes.js). The auth
 * interceptor adds the signed-in user's ID token, which /match/best requires
 * and /match/search uses for larger pages.
 */
@Injectable( { providedIn: 'root' } )
export class MatchApiService {
  private readonly http = inject( HttpClient );
  private readonly apiRoot = environment.backendURL;
  private vocabulary$?: Observable<MatchVocabulary>;
  private naics$?: Observable<NaicsOption[]>;

  vocabulary (): Observable<MatchVocabulary> {
    this.vocabulary$ ??= this.http
      .get<MatchVocabulary>( `${ this.apiRoot }/lead-vault/match/vocabulary` )
      .pipe( shareReplay( 1 ) );
    return this.vocabulary$;
  }

  count ( criteria: MatchCriteria ): Observable<number> {
    return this.http
      .post<{ count: number }>( `${ this.apiRoot }/lead-vault/match/count`, { criteria } )
      .pipe( map( ( response ) => response.count ) );
  }

  search ( criteria: MatchCriteria, offset = 0, limit?: number ): Observable<MatchSearchResponse> {
    return this.http.post<MatchSearchResponse>( `${ this.apiRoot }/lead-vault/match/search`, { criteria, offset, limit } );
  }

  best ( criteria: MatchCriteria, company: MatchCompany | null ): Observable<BestMatch | null> {
    return this.http
      .post<{ best: BestMatch | null }>( `${ this.apiRoot }/lead-vault/match/best`, { criteria, company } )
      .pipe( map( ( response ) => response.best ) );
  }

  /** Six-digit 2022 NAICS codes from the same list TODD's picker uses. */
  naicsOptions (): Observable<NaicsOption[]> {
    this.naics$ ??= this.http.get( 'assets/lead-vault/naics.csv', { responseType: 'text' } ).pipe(
      map( ( csv ) => csv.split( /\r?\n/ ).flatMap( ( line ) => {
        const match = line.match( /^(\d{6}),"?(.*?)"?$/ );
        return match ? [ { code: match[ 1 ], title: match[ 2 ].replace( /T$/, '' ).trim() } ] : [];
      } ) ),
      shareReplay( 1 ),
    );
    return this.naics$;
  }
}
