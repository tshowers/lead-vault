import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

/**
 * Ported near-verbatim from the monorepo's
 * features/lead-vault/services/lead-vault.service.ts (301 lines) - already
 * pure HttpClient, zero Firestore coupling, so this is close to a straight
 * copy with only the class rename (LeadVaultService -> LeadVaultApiService,
 * to avoid clashing with the app's own name) and the relative environment
 * import path adjusted for this project's shallower folder depth.
 *
 * Endpoints are keyed mostly by email, not tenant - the search/preview/
 * unlock flow works for anonymous visitors. The one tenant-scoped call is
 * createUnlimitedCheckout(tenantId, email), used only from the full-record
 * page's "unlimited subscription" upsell.
 */
@Injectable( {
  providedIn: 'root'
} )
export class LeadVaultApiService {
  private readonly apiRoot = environment.backendURL;

  constructor ( private readonly http: HttpClient ) { }

  search ( request: {
    query?: string;
    sector?: string;
    state?: string;
    capability?: string;
    companyName?: string;
    personName?: string;
    limit?: number;
  } ): Observable<{
    success: boolean;
    count: number;
    results: any[];
  }> {
    return this.http.post<{
      success: boolean;
      count: number;
      results: any[];
    }>( this.buildApiUrl( '/lead-vault/search' ), request || {} );
  }

  /**
   * Requires a signed-in TODD user - this now burns a real, paid email-
   * validation credit per call, so `idToken` (from
   * LeadVaultAuthService.getIdToken()) is required, not optional.
   */
  validateEmail ( email: string, idToken: string ): Observable<{
    success: boolean;
    verdict: 'Valid' | 'Risky' | 'Invalid' | string;
    score: number;
    matched: boolean;
    record?: any;
    code?: string;
    message?: string;
  }> {
    return this.http.post<{
      success: boolean;
      verdict: 'Valid' | 'Risky' | 'Invalid' | string;
      score: number;
      matched: boolean;
      record?: any;
      code?: string;
      message?: string;
    }>( this.buildApiUrl( '/lead-vault/validate-email' ), {
      email: this.normalizeEmail( email )
    }, {
      headers: new HttpHeaders( { Authorization: `Bearer ${idToken}` } )
    } );
  }

  getPreview ( recordId: string ): Observable<{
    success: boolean;
    record: any;
  }> {
    return this.http.get<{
      success: boolean;
      record: any;
    }>( this.buildApiUrl( `/lead-vault/record/${encodeURIComponent( recordId )}/preview` ) );
  }

  getMomentumPreparedSet ( setId: string ): Observable<{
    success: boolean;
    data: {
      id: string;
      status: string;
      candidateCount: number;
      candidates: any[];
      rationale?: string;
      createdAt?: string;
    };
  }> {
    return this.http.get<{
      success: boolean;
      data: {
        id: string;
        status: string;
        candidateCount: number;
        candidates: any[];
        rationale?: string;
        createdAt?: string;
      };
    }>( this.buildApiUrl( `/momentum/prepared-lead-sets/${encodeURIComponent( setId )}` ) );
  }

  checkAccess ( recordId: string, email: string ): Observable<{
    success: boolean;
    hasAccess: boolean;
    recordId: string;
    email: string;
  }> {
    const params = new HttpParams().set( 'email', this.normalizeEmail( email ) );

    return this.http.get<{
      success: boolean;
      hasAccess: boolean;
      recordId: string;
      email: string;
    }>(
      this.buildApiUrl( `/lead-vault/record/${encodeURIComponent( recordId )}/access` ),
      { params }
    );
  }

  createCheckout ( recordId: string, email: string ): Observable<{
    success: boolean;
    alreadyOwned?: boolean;
    recordId?: string;
    email?: string;
    checkoutUrl?: string;
    sessionId?: string;
    orderId?: string;
    amount?: number;
    currency?: string;
  }> {
    return this.http.post<{
      success: boolean;
      alreadyOwned?: boolean;
      recordId?: string;
      email?: string;
      checkoutUrl?: string;
      sessionId?: string;
      orderId?: string;
      amount?: number;
      currency?: string;
    }>( this.buildApiUrl( '/lead-vault/checkout' ), {
      recordId,
      email: this.normalizeEmail( email )
    } );
  }

  confirmCheckout ( sessionId: string ): Observable<{
    success: boolean;
    recordId?: string;
    email?: string;
    entitlementId?: string;
    paymentStatus?: string;
  }> {
    return this.http.post<{
      success: boolean;
      recordId?: string;
      email?: string;
      entitlementId?: string;
      paymentStatus?: string;
    }>( this.buildApiUrl( '/lead-vault/checkout/confirm' ), {
      sessionId
    } );
  }

  createRecommendationCheckout ( recordId: string, email: string, goal: string ): Observable<{
    success: boolean;
    alreadyOwned?: boolean;
    recordId?: string;
    email?: string;
    goal?: string;
    checkoutUrl?: string;
    sessionId?: string;
    orderId?: string;
    amount?: number;
    currency?: string;
  }> {
    return this.http.post<{
      success: boolean;
      alreadyOwned?: boolean;
      recordId?: string;
      email?: string;
      goal?: string;
      checkoutUrl?: string;
      sessionId?: string;
      orderId?: string;
      amount?: number;
      currency?: string;
    }>( this.buildApiUrl( '/lead-vault/recommendation/checkout' ), {
      recordId,
      email: this.normalizeEmail( email ),
      goal: ( goal || 'general' ).trim()
    } );
  }

  confirmRecommendationCheckout ( sessionId: string ): Observable<{
    success: boolean;
    recordId?: string;
    email?: string;
    goal?: string;
    entitlementId?: string;
    paymentStatus?: string;
  }> {
    return this.http.post<{
      success: boolean;
      recordId?: string;
      email?: string;
      goal?: string;
      entitlementId?: string;
      paymentStatus?: string;
    }>( this.buildApiUrl( '/lead-vault/recommendation/checkout/confirm' ), {
      sessionId
    } );
  }

  getRecommendation ( recordId: string, email: string, goal: string ): Observable<{
    success: boolean;
    recordId?: string;
    email?: string;
    goal?: string;
    recommendation?: any;
    cached?: boolean;
    message?: string;
  }> {
    const params = new HttpParams()
      .set( 'email', this.normalizeEmail( email ) )
      .set( 'goal', ( goal || 'general' ).trim() );

    return this.http.get<{
      success: boolean;
      recordId?: string;
      email?: string;
      goal?: string;
      recommendation?: any;
      cached?: boolean;
      message?: string;
    }>(
      this.buildApiUrl( `/lead-vault/recommendation/${encodeURIComponent( recordId )}` ),
      { params }
    );
  }

  generateRecommendation ( recordId: string, email: string, goal: string, record: any ): Observable<{
    response?: any;
    cached?: boolean;
    error?: string;
  }> {
    return this.http.post<{
      response?: any;
      cached?: boolean;
      error?: string;
    }>( this.buildApiUrl( '/lead-vault-recommendation' ), {
      recordId,
      purchaserEmail: this.normalizeEmail( email ),
      goal: ( goal || 'general' ).trim(),
      record
    } );
  }

  createUnlimitedCheckout ( tenantId: string, email: string ): Observable<{
    success: boolean;
    sessionId?: string;
    url?: string;
  }> {
    return this.http.post<{
      success: boolean;
      sessionId?: string;
      url?: string;
    }>( this.buildApiUrl( '/lead-vault-unlimited/checkout' ), {
      tenantId,
      email: this.normalizeEmail( email )
    } );
  }

  confirmUnlimitedCheckout ( sessionId: string ): Observable<{
    success: boolean;
    tenantId?: string;
    feature?: string;
    subscriptionStatus?: string;
  }> {
    return this.http.post<{
      success: boolean;
      tenantId?: string;
      feature?: string;
      subscriptionStatus?: string;
    }>( this.buildApiUrl( '/lead-vault-unlimited/checkout/confirm' ), {
      sessionId
    } );
  }

  getFullRecord ( recordId: string, email: string ): Observable<{
    success: boolean;
    record: any;
  }> {
    const params = new HttpParams().set( 'email', this.normalizeEmail( email ) );

    return this.http.get<{
      success: boolean;
      record: any;
    }>(
      this.buildApiUrl( `/lead-vault/record/${encodeURIComponent( recordId )}/full` ),
      { params }
    );
  }

  private buildApiUrl ( path: string ): string {
    const normalizedPath = path.startsWith( '/' ) ? path : `/${path}`;
    return `${this.apiRoot}${normalizedPath}`;
  }

  private normalizeEmail ( email: string ): string {
    return ( email || '' ).trim().toLowerCase();
  }

}
