import { Injectable } from '@angular/core';
import { Observable, catchError, distinctUntilChanged, map, of, shareReplay, startWith, switchMap } from 'rxjs';
import { LeadVaultAccessLevel, LeadVaultApiService } from './lead-vault-api.service';
import { LeadVaultAuthService } from './lead-vault-auth.service';

export interface LeadVaultViewer {
  status: 'loading' | 'signed-out' | 'signed-in';
  email: string;
  accessLevel: LeadVaultAccessLevel;
  /** Master tenant, TODD Suite, or Lead Vault Unlimited - every record opens. */
  hasFullAccess: boolean;
  freeTrialAvailable: boolean;
  /** Short badge text, e.g. "Master access". */
  label: string;
}

const LOADING: LeadVaultViewer = {
  status: 'loading', email: '', accessLevel: 'none', hasFullAccess: false, freeTrialAvailable: false, label: '',
};
const SIGNED_OUT: LeadVaultViewer = { ...LOADING, status: 'signed-out' };

const ACCESS_LABELS: Record<LeadVaultAccessLevel, string> = {
  'master-tenant': 'Master access',
  'suite-subscriber': 'TODD Suite · full access',
  'unlimited-subscriber': 'Unlimited · full access',
  'free-trial-available': '1 free reveal',
  'none': 'Pay per lead',
};

/**
 * Who is looking at Lead Vault right now and what they can open. Re-resolved
 * on every Firebase auth change and shared across the header chip, search
 * results, and the preview page so they never disagree.
 */
@Injectable( { providedIn: 'root' } )
export class LeadVaultViewerService {
  readonly viewer$: Observable<LeadVaultViewer>;

  constructor ( authService: LeadVaultAuthService, api: LeadVaultApiService ) {
    this.viewer$ = typeof window === 'undefined'
      ? of( SIGNED_OUT )
      : authService.getUser().pipe(
        map( ( user ) => user?.uid || '' ),
        distinctUntilChanged(),
        switchMap( ( uid ) => uid ? this.loadViewer( api, authService ) : of( SIGNED_OUT ) ),
        startWith( LOADING ),
        shareReplay( { bufferSize: 1, refCount: false } ),
      );
  }

  private loadViewer ( api: LeadVaultApiService, authService: LeadVaultAuthService ): Observable<LeadVaultViewer> {
    const fallbackEmail = authService.getCurrentUserEmailSync();

    return api.getViewer().pipe(
      map( ( response ): LeadVaultViewer => {
        const accessLevel = response?.accessLevel || 'none';
        return {
          status: 'signed-in',
          email: response?.email || fallbackEmail,
          accessLevel,
          hasFullAccess: !!response?.hasFullAccess,
          freeTrialAvailable: accessLevel === 'free-trial-available',
          label: ACCESS_LABELS[accessLevel] || ACCESS_LABELS.none,
        };
      } ),
      // Signed in, but the access lookup failed - still show who they are.
      catchError( () => of<LeadVaultViewer>( {
        ...SIGNED_OUT, status: 'signed-in', email: fallbackEmail, label: 'Signed in',
      } ) ),
      startWith( LOADING ),
    );
  }
}
