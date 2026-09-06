import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { saveAs } from 'file-saver';
import { LeadVaultApiService } from '../../services/lead-vault-api.service';
import { ContactMapComponent } from '../../shared/contact-map/contact-map.component';
import { EmailOptionButtonComponent } from '../../shared/email-option-button/email-option-button.component';
import { PreloaderComponent } from '../../shared/preloader/preloader.component';
import { LeadVaultAuthService } from '../../services/lead-vault-auth.service';
import { LeadVaultDataService } from '../../services/lead-vault-data.service';
import { LeadVaultContactAccessService, ContactAccessState } from '../../services/lead-vault-contact-access.service';
import { LeadVaultContactPackService } from '../../services/lead-vault-contact-pack.service';
import { Contact } from '../../models/contact.model';
import { isInvalidLeadVaultRecordId } from '../../utils/lead-vault-record-id.util';
import { LoggerService } from '../../services/logger.service';

/**
 * Trimmed port of lead-vault-full-record-page.component.ts (778 TS / 220
 * HTML / 823 CSS in the monorepo). This is the one component with real
 * cross-module reach - see the plan's "Option A" decision (keep, don't
 * strip, the Contact/Outreach features). What changed from the original:
 *
 *  - ContactService and DataService -> dropped. DataService.addDocument/
 *    getRecordIdIfExists are replaced by LeadVaultDataService (a copy of
 *    Network's NetworkDataService, trimmed to addContact() + a new
 *    getContactIdByEmail() lookup). ContactService was only used for
 *    changeContact()+resetReason() ahead of an in-app /compose-email
 *    navigation - see onComposeInToddFromLead() below for the cross-app
 *    replacement.
 *  - ContactAccessService -> LeadVaultContactAccessService (copy of
 *    Network's NetworkContactAccessService, auth-swapped - already the
 *    exact shape this page needs).
 *  - NetworkContactPackService -> LeadVaultContactPackService (copy,
 *    auth-swapped).
 *  - Cypress test-auth override (isCypressRuntime/getCypressContacts/
 *    setCypressContacts, and the branch in addToTodd() that used them) is
 *    dropped, matching the same trim NetworkContactAccessService already
 *    made for its own Cypress override.
 *  - onComposeInToddFromLead(): the original set ContactService's
 *    in-memory selected contact, then router.navigate(['/compose-email'])
 *    - an in-app TODD route. Per the plan's decision, Outreach/email-
 *    composition isn't part of either extracted product, so this is now a
 *    real cross-app navigation to the monorepo's own production domain
 *    (https://todd.taliferro.tech/compose-email, confirmed from the
 *    monorepo's own environment.prod.ts PLATFORM_URL - not a guess). Best-
 *    effort query params (email/firstName/lastName/company) are attached
 *    in case the monorepo's compose-email flow ever reads them, but there
 *    is no guarantee it will pre-fill from a fresh cross-origin page load
 *    the way it does from Contact Service's in-memory state today - flag
 *    this to the user as a known limitation of the cross-app handoff.
 *  - EmailOptionButtonComponent's AI-drafting path is replaced by a
 *    simplified local component - see shared/email-option-button's own
 *    header comment for why.
 *  - Route targets shortened (/lead-vault -> /, /bad-request -> / for
 *    invalid record ids, same deviation as the preview page).
 */
@Component( {
  selector: 'app-full-record-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ContactMapComponent, EmailOptionButtonComponent, PreloaderComponent],
  templateUrl: './full-record-page.component.html',
  styleUrl: './full-record-page.component.css'
} )
export class FullRecordPageComponent implements OnInit {
  /** The monorepo's real production domain - see header comment. */
  readonly toddHomeUrl = 'https://todd.taliferro.tech';

  recordId = '';
  purchaserEmail = '';
  isLoading = true;
  errorMessage = '';
  actionMessage = '';
  actionErrorMessage = '';
  recommendationGoal = 'Introduce my service';
  recommendationCheckoutInProgress = false;
  recommendationLoading = false;
  recommendationMessage = '';
  recommendationErrorMessage = '';
  recommendation: any = null;
  addToToddInProgress = false;
  accessState: ContactAccessState | null = null;

  fullRecord: {
    id: string;
    fullName: string;
    firstName: string;
    lastName: string;
    companyName: string;
    title: string;
    sector: string;
    city: string;
    state: string;
    country: string;
    latitude?: number | null;
    longitude?: number | null;
    addresses?: Array<{
      streetAddress?: string;
      city?: string;
      state?: string;
      zip?: string;
      country?: string;
      county?: string;
      addressType?: string;
      latitude?: number | null;
      longitude?: number | null;
    }>;
    capabilities: string[];
    email: string;
    emailMasked: string;
    emailChecked?: boolean;
    emailBlocked?: boolean;
    emailCheckedAt?: string | null;
    linkedInUrl: string;
    phoneNumbers: Array<any>;
    company: {
      name: string;
      capabilities: string[];
      description: string;
      size: string;
      addresses?: Array<{
        streetAddress?: string;
        city?: string;
        state?: string;
        zip?: string;
        country?: string;
        county?: string;
        addressType?: string;
        latitude?: number | null;
        longitude?: number | null;
      }>;
      phoneNumbers?: Array<any>;
    };
    qualityScore: number;
  } | null = null;

  constructor (
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly leadVaultService: LeadVaultApiService,
    private readonly authService: LeadVaultAuthService,
    private readonly dataService: LeadVaultDataService,
    private readonly contactAccessService: LeadVaultContactAccessService,
    private readonly contactPackService: LeadVaultContactPackService,
    private readonly logger: LoggerService
  ) { }

  get leadVaultContact (): Contact | null {
    return this.fullRecord ? this.mapLeadToContact( this.fullRecord ) : null;
  }

  get currentUserId (): string | undefined {
    return this.authService.getCurrentUserIdSync() || undefined;
  }

  ngOnInit (): void {
    this.recordId = ( this.route.snapshot.paramMap.get( 'id' ) || '' ).trim();
    this.purchaserEmail = this.resolvePurchaserEmail();

    if ( isInvalidLeadVaultRecordId( this.recordId ) ) {
      this.router.navigate( ['/'], { replaceUrl: true } );
      return;
    }

    if ( !this.purchaserEmail ) {
      this.isLoading = false;
      this.errorMessage = 'Purchaser email is missing.';
      return;
    }

    this.loadFullRecord();
    this.handleRecommendationReturn();
    this.refreshAccessState();
  }
  backToLeadVault (): void {
    this.router.navigate( ['/'] );
  }

  downloadCsv (): void {
    if ( !this.fullRecord ) {
      this.actionErrorMessage = 'No unlocked record is available to download.';
      this.actionMessage = '';
      return;
    }

    const record = this.fullRecord;
    const row = {
      fullName: record.fullName || '',
      firstName: record.firstName || '',
      lastName: record.lastName || '',
      companyName: record.companyName || '',
      title: record.title || '',
      sector: record.sector || '',
      city: record.city || '',
      state: record.state || '',
      country: record.country || '',
      email: record.email || '',
      linkedInUrl: record.linkedInUrl || '',
      phoneNumbers: ( record.phoneNumbers || [] )
        .map( ( phone: any ) => phone?.phoneNumber || phone || '' )
        .filter( Boolean )
        .join( ' | ' ),
      capabilities: ( record.capabilities || [] ).join( ' | ' ),
      companyDescription: record.company?.description || '',
      companySize: record.company?.size || '',
      qualityScore: record.qualityScore || 0
    };

    const headers = Object.keys( row );
    const escapeCsv = ( value: unknown ): string => {
      const stringValue = ( value ?? '' ).toString();
      const escapedValue = stringValue.replace( /"/g, '""' );
      return `"${escapedValue}"`;
    };

    const csvRows = [
      headers.join( ',' ),
      headers.map( ( key ) => escapeCsv( row[key as keyof typeof row] ) ).join( ',' ),
    ];

    const csvContent = csvRows.join( '\n' );
    const blob = new Blob( [csvContent], { type: 'text/csv;charset=utf-8;' } );
    const safeCompanyName = ( record.companyName || 'lead-vault-record' )
      .toLowerCase()
      .replace( /[^a-z0-9]+/g, '-' )
      .replace( /^-+|-+$/g, '' ) || 'lead-vault-record';

    saveAs( blob, `${safeCompanyName}.csv` );
    this.actionErrorMessage = '';
    this.actionMessage = 'CSV downloaded.';
  }

  async copyEmail (): Promise<void> {
    const email = ( this.fullRecord?.email || '' ).trim();

    if ( !email ) {
      this.actionErrorMessage = 'No email is available to copy.';
      this.actionMessage = '';
      return;
    }

    try {
      await navigator.clipboard.writeText( email );
      this.actionErrorMessage = '';
      this.actionMessage = 'Email copied.';
    } catch {
      this.actionMessage = '';
      this.actionErrorMessage = 'Unable to copy email.';
    }
  }

  async copyFullRecord (): Promise<void> {
    if ( !this.fullRecord ) {
      this.actionErrorMessage = 'No unlocked record is available to copy.';
      this.actionMessage = '';
      return;
    }

    const record = this.fullRecord;
    const phoneNumbers = ( record.phoneNumbers || [] )
      .map( ( phone: any ) => phone?.phoneNumber || phone || '' )
      .filter( Boolean )
      .join( ', ' );
    const capabilities = ( record.capabilities || [] ).join( ', ' );

    const lines = [
      `Name: ${record.fullName || ''}`,
      `Company: ${record.companyName || ''}`,
      `Title: ${record.title || ''}`,
      `Sector: ${record.sector || ''}`,
      `Email: ${record.email || ''}`,
      `Phone Numbers: ${phoneNumbers}`,
      `LinkedIn: ${record.linkedInUrl || ''}`,
      `Location: ${[record.city, record.state, record.country].filter( Boolean ).join( ', ' )}`,
      `Capabilities: ${capabilities}`,
      `Company Description: ${record.company?.description || ''}`,
      `Company Size: ${record.company?.size || ''}`,
      `Quality Score: ${record.qualityScore || 0}`,
    ];

    try {
      await navigator.clipboard.writeText( lines.join( '\n' ) );
      this.actionErrorMessage = '';
      this.actionMessage = 'Full record copied.';
    } catch {
      this.actionMessage = '';
      this.actionErrorMessage = 'Unable to copy full record.';
    }
  }

  private async refreshAccessState (): Promise<void> {
    try {
      this.accessState = await this.contactAccessService.getAccessState();
    } catch {
      this.accessState = null;
    }
  }

  signInToTodd (): void {
    this.authService.signIn( `/full/${this.recordId}` );
  }

  async addToTodd (): Promise<void> {
    this.actionErrorMessage = '';
    this.actionMessage = '';

    await this.refreshAccessState();

    if ( !this.accessState?.isLoggedIn ) {
      this.authService.signIn( `/full/${this.recordId}` );
      return;
    }

    if ( !this.accessState.isPaidUser && !this.accessState.canAddContact ) {
      this.actionErrorMessage = 'Free users can keep up to 10 contacts. Upgrade to add more leads to TODD.';
      return;
    }

    if ( !this.fullRecord ) {
      this.actionErrorMessage = 'No unlocked lead is available to add.';
      return;
    }

    this.addToToddInProgress = true;

    try {
      const newContact = this.mapLeadToContact( this.fullRecord );
      const uid = this.authService.getCurrentUserIdSync();
      const tenantId = uid ? await this.authService.resolveTenantId( uid ) : '';

      if ( !tenantId ) {
        this.actionErrorMessage = 'Unable to resolve your TODD tenant. Please sign in again.';
        return;
      }

      const existingId = await this.dataService.getContactIdByEmail( tenantId, newContact.email || '' );

      if ( existingId ) {
        this.actionMessage = 'This lead is already in TODD.';
        return;
      }

      await this.dataService.addContact( tenantId, newContact );
      this.actionMessage = 'Lead added to TODD.';
      await this.refreshAccessState();
    } catch ( error: any ) {
      if ( this.contactPackService.isContactLimitError( error ) ) {
        try {
          const startedCheckout = await this.contactPackService.promptAndStartCheckout();
          if ( !startedCheckout ) {
            this.actionErrorMessage = this.contactPackService.upgradePromptMessage.replace( '\n', ' ' );
          }
        } catch ( checkoutError: any ) {
          this.actionErrorMessage = checkoutError?.message || this.contactPackService.limitErrorMessage;
        }
        return;
      }

      this.actionErrorMessage = error?.message || 'Unable to add this lead to TODD.';
    } finally {
      this.addToToddInProgress = false;
    }
  }

  /**
   * Cross-app handoff, not an in-app route - see header comment. Opens
   * the monorepo's real /compose-email in the same tab, with best-effort
   * prefill query params.
   */
  onComposeInToddFromLead ( event?: { contact: Contact | null; emailAddress: string | undefined; } ): void {
    if ( !this.accessState?.isLoggedIn ) {
      this.actionErrorMessage = 'Sign in to email this lead in TODD.';
      return;
    }

    const contact = event?.contact || this.leadVaultContact;
    if ( !contact ) {
      this.actionErrorMessage = 'No unlocked lead is available to email.';
      return;
    }

    const params = new URLSearchParams();
    if ( contact.email ) params.set( 'email', contact.email );
    if ( contact.firstName ) params.set( 'firstName', contact.firstName );
    if ( contact.lastName ) params.set( 'lastName', contact.lastName );
    if ( contact.company?.name ) params.set( 'company', contact.company.name );

    const query = params.toString();
    window.location.href = `${this.toddHomeUrl}/compose-email${query ? `?${query}` : ''}`;
  }

  private mapLeadToContact ( record: NonNullable<FullRecordPageComponent['fullRecord']> ): Contact {
    const firstEmail = ( record.email || '' ).trim().toLowerCase();
    const phoneNumbers = ( record.phoneNumbers || [] )
      .map( ( phone: any ) => {
        const phoneNumber = ( phone?.phoneNumber || phone || '' ).toString().trim();
        return phoneNumber
          ? { phoneNumber, phoneNumberType: phone?.phoneNumberType || 'work' }
          : null;
      } )
      .filter( Boolean ) as Contact['phoneNumbers'];

    return {
      firstName: record.firstName || '',
      middleName: '',
      lastName: record.lastName || '',
      email: firstEmail,
      emailAddresses: firstEmail
        ? [{ emailAddress: firstEmail, emailAddressType: 'primary', blocked: !!record.emailBlocked, checked: !!record.emailChecked }]
        : [],
      linkedInUrl: record.linkedInUrl || '',
      profession: record.title || '',
      sector: record.sector || '',
      type: 'lead-vault',
      status: 'Lead Generation',
      acquisitionSource: 'lead-vault',
      dateAdded: new Date().toISOString(),
      lastContacted: new Date().toISOString(),
      recentCampaign: false,
      company: {
        name: record.companyName || record.company?.name || '',
        description: record.company?.description || '',
        numberOfEmployees: record.company?.size || '',
        capabilities: record.company?.capabilities || record.capabilities || [],
        phoneNumbers: [],
        emailAddresses: [],
        addresses: [],
        other: '',
        url: '',
        sicCode: '',
        status: '',
        shared: false
      },
      phoneNumbers: phoneNumbers || [],
      images: [{
        src: 'assets/nophoto.svg',
        alt: 'No photo available'
      }],
      connectionDetails: {
        startDate: new Date().toISOString(),
        mutualConnections: 0,
        transactionHistory: []
      },
      engagements: [],
      interactions: [],
      statusHistory: [],
      contactValue: 0,
      subscriber: false,
      important: record.qualityScore >= 80
    };
  }

  startRecommendationCheckout (): void {
    if ( !this.recordId ) {
      this.recommendationErrorMessage = 'Lead Vault record id is missing.';
      this.recommendationMessage = '';
      return;
    }

    if ( !this.purchaserEmail ) {
      this.recommendationErrorMessage = 'Purchaser email is missing.';
      this.recommendationMessage = '';
      return;
    }

    const goal = ( this.recommendationGoal || 'Introduce my service' ).trim();

    this.recommendationCheckoutInProgress = true;
    this.recommendationErrorMessage = '';
    this.recommendationMessage = 'Starting recommendation checkout...';

    this.leadVaultService.createRecommendationCheckout( this.recordId, this.purchaserEmail, goal ).subscribe( {
      next: ( response ) => {
        this.recommendationCheckoutInProgress = false;

        if ( response?.alreadyOwned ) {
          this.recommendationMessage = 'Recommendation access found. Loading...';
          this.loadRecommendation();
          return;
        }

        if ( response?.checkoutUrl ) {
          window.location.href = response.checkoutUrl;
          return;
        }

        this.recommendationMessage = '';
        this.recommendationErrorMessage = 'Recommendation checkout URL was not returned.';
      },
      error: ( error ) => {
        this.recommendationCheckoutInProgress = false;
        this.recommendationMessage = '';
        this.recommendationErrorMessage =
          error?.error?.message ||
          error?.message ||
          'Recommendation checkout failed.';
      }
    } );
  }

  loadRecommendation (): void {
    if ( !this.recordId || !this.purchaserEmail ) {
      return;
    }

    const goal = ( this.recommendationGoal || 'Introduce my service' ).trim();

    this.recommendationLoading = true;
    this.recommendationErrorMessage = '';
    this.recommendationMessage = 'Loading recommendation...';

    this.leadVaultService.getRecommendation( this.recordId, this.purchaserEmail, goal ).subscribe( {
      next: ( response ) => {
        this.recommendationLoading = false;
        this.recommendation = response?.recommendation || null;

        if ( response?.recommendation ) {
          this.recommendationMessage = response?.cached ? 'Recommendation loaded.' : 'Recommendation ready.';
          return;
        }

        if ( this.fullRecord ) {
          this.recommendationMessage = 'Generating your recommendation...';
          this.recommendationErrorMessage = '';
          this.generateRecommendation();
          return;
        }

        this.recommendationMessage = response?.message || 'Recommendation not generated yet.';
      },
      error: ( error ) => {
        this.recommendationLoading = false;
        this.recommendationMessage = '';
        this.recommendationErrorMessage =
          error?.error?.message ||
          error?.message ||
          'Recommendation retrieval failed.';
      }
    } );
  }

  private generateRecommendation (): void {
    if ( !this.recordId || !this.purchaserEmail || !this.fullRecord ) {
      this.recommendationMessage = '';
      this.recommendationErrorMessage = 'Recommendation generation could not start.';
      return;
    }

    const goal = ( this.recommendationGoal || 'Introduce my service' ).trim();

    this.recommendationLoading = true;
    this.recommendationErrorMessage = '';
    this.recommendationMessage = 'Generating your recommendation...';

    this.leadVaultService.generateRecommendation(
      this.recordId,
      this.purchaserEmail,
      goal,
      this.fullRecord
    ).subscribe( {
      next: ( response ) => {
        this.recommendationLoading = false;
        this.recommendation = response?.response || null;
        this.recommendationMessage = 'Recommendation ready.';
      },
      error: ( error ) => {
        this.recommendationLoading = false;
        this.recommendationMessage = '';
        this.recommendationErrorMessage =
          error?.error?.error ||
          error?.error?.message ||
          error?.message ||
          'Recommendation generation failed.';
      }
    } );
  }

  getScoreTier ( score: number ): 'strong' | 'good' | 'fair' {
    if ( score >= 80 ) return 'strong';
    if ( score >= 60 ) return 'good';
    return 'fair';
  }

  onRecommendationGoalChange ( goal: string ): void {
    this.recommendationGoal = ( goal || 'Introduce my service' ).trim();
    this.recommendationMessage = '';
    this.recommendationErrorMessage = '';
    this.recommendation = null;
  }

  getMapLatitude (): number | null {
    const companyLatitude = this.fullRecord?.company?.addresses?.[0]?.latitude;
    if ( typeof companyLatitude === 'number' && Number.isFinite( companyLatitude ) ) {
      return companyLatitude;
    }

    const directLatitude = this.fullRecord?.addresses?.[0]?.latitude;
    if ( typeof directLatitude === 'number' && Number.isFinite( directLatitude ) ) {
      return directLatitude;
    }

    const topLevelLatitude = this.fullRecord?.latitude;
    if ( typeof topLevelLatitude === 'number' && Number.isFinite( topLevelLatitude ) ) {
      return topLevelLatitude;
    }

    return null;
  }

  getMapLongitude (): number | null {
    const companyLongitude = this.fullRecord?.company?.addresses?.[0]?.longitude;
    if ( typeof companyLongitude === 'number' && Number.isFinite( companyLongitude ) ) {
      return companyLongitude;
    }

    const directLongitude = this.fullRecord?.addresses?.[0]?.longitude;
    if ( typeof directLongitude === 'number' && Number.isFinite( directLongitude ) ) {
      return directLongitude;
    }

    const topLevelLongitude = this.fullRecord?.longitude;
    if ( typeof topLevelLongitude === 'number' && Number.isFinite( topLevelLongitude ) ) {
      return topLevelLongitude;
    }

    return null;
  }

  getDisplayAddress (): string {
    const companyAddress = this.fullRecord?.company?.addresses?.[0];
    const directAddress = this.fullRecord?.addresses?.[0];
    const address = companyAddress || directAddress;

    if ( !address ) return '';

    return [
      address.addressType ? `(${address.addressType})` : '',
      address.streetAddress || '',
      [address.city || '', address.state || '', address.zip || ''].filter( Boolean ).join( ' ' ),
      [address.county || '', address.country || ''].filter( Boolean ).join( ' ' ),
    ]
      .filter( Boolean )
      .join( ' ' )
      .trim();
  }

  hasMapLocation (): boolean {
    return this.getMapLatitude() !== null && this.getMapLongitude() !== null;
  }

  openMap (): void {
    const query = this.buildMapQuery();
    if ( !query ) return;

    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent( query )}`;
    window.open( url, '_blank', 'noopener,noreferrer' );
  }

  private buildMapQuery (): string {
    if ( !this.fullRecord ) return '';

    const displayAddress = this.getDisplayAddress();
    if ( displayAddress ) {
      return [
        this.fullRecord.companyName || '',
        displayAddress,
      ]
        .map( ( part ) => ( part || '' ).trim() )
        .filter( Boolean )
        .join( ', ' );
    }

    return [
      this.fullRecord.companyName || '',
      this.fullRecord.city || '',
      this.fullRecord.state || '',
      this.fullRecord.country || '',
    ]
      .map( ( part ) => ( part || '' ).trim() )
      .filter( Boolean )
      .join( ', ' );
  }

  private handleRecommendationReturn (): void {
    const sessionId = ( this.route.snapshot.queryParamMap.get( 'session_id' ) || '' ).trim();
    const type = ( this.route.snapshot.queryParamMap.get( 'type' ) || '' ).trim().toLowerCase();

    if ( !sessionId || type !== 'recommendation' ) {
      return;
    }

    this.recommendationMessage = 'Confirming recommendation purchase...';
    this.recommendationErrorMessage = '';

    this.leadVaultService.confirmRecommendationCheckout( sessionId ).subscribe( {
      next: ( response ) => {
        if ( response?.goal ) {
          this.recommendationGoal = response.goal;
        }

        this.recommendationMessage = 'Recommendation purchase confirmed.';
        this.recommendationErrorMessage = '';
        this.loadRecommendation();
      },
      error: ( error ) => {
        this.recommendationMessage = '';
        this.recommendationErrorMessage =
          error?.error?.message ||
          error?.message ||
          'Recommendation confirmation failed.';
      }
    } );
  }

  private loadFullRecord (): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.leadVaultService.getFullRecord( this.recordId, this.purchaserEmail ).subscribe( {
      next: ( response ) => {
        this.logger.info( 'Lead Vault full record response:', response );

        this.fullRecord = response?.record || null;

        if ( !this.fullRecord ) {
          this.errorMessage = 'Lead Vault record was not found.';
          this.actionMessage = '';
          this.recommendationMessage = '';
          this.actionErrorMessage = '';
          this.recommendationErrorMessage = '';
          this.isLoading = false;
          return;
        }

        this.actionMessage = '';
        if ( !this.route.snapshot.queryParamMap.get( 'session_id' ) ) {
          this.recommendationMessage = '';
        }
        this.actionErrorMessage = '';
        this.recommendationErrorMessage = '';
        this.isLoading = false;
      },
      error: ( error ) => {
        this.fullRecord = null;
        this.actionMessage = '';
        this.recommendationMessage = '';
        this.actionErrorMessage = '';
        this.recommendationErrorMessage = '';
        this.isLoading = false;
        this.errorMessage =
          error?.error?.message ||
          error?.message ||
          'Lead Vault full record failed.';
      }
    } );
  }

  private resolvePurchaserEmail (): string {
    const queryEmail = ( this.route.snapshot.queryParamMap.get( 'email' ) || '' ).trim().toLowerCase();

    if ( queryEmail ) {
      localStorage.setItem( 'leadVaultEmail', queryEmail );
      return queryEmail;
    }

    const storedEmail = ( localStorage.getItem( 'leadVaultEmail' ) || '' ).trim().toLowerCase();
    if ( storedEmail ) {
      return storedEmail;
    }

    const signedInEmail = this.authService.getCurrentUserEmailSync().trim().toLowerCase();
    if ( signedInEmail ) {
      localStorage.setItem( 'leadVaultEmail', signedInEmail );
    }

    return signedInEmail;
  }
}
