import { Injectable } from '@angular/core';

/**
 * No-op stand-in for the page-context/activity-reporting slice of
 * ToddAssistantBusService - copied verbatim from web-products/network's
 * NetworkAssistantSignalService. Confirmed only LeadVaultSearchPageComponent
 * uses ToddAssistantBusService in Lead Vault (grepped the monorepo's
 * lead-vault-search-page.component.ts): it calls setPageContext,
 * clearPageContext, and emitAssistantActivity - all covered here. This app
 * deliberately doesn't carry TODD's full assistant bus (see Network's own
 * scoping note), so ported calls have nowhere to go. Kept as a same-shaped
 * no-op rather than deleted from each call site to minimize the diff.
 */
@Injectable( { providedIn: 'root' } )
export class LeadVaultAssistantSignalService {
  emitAssistantActivity ( _event: Record<string, unknown> ): void { }
  setPageContext ( _context: Record<string, unknown> ): void { }
  clearPageContext (): void { }
  pushTranscript ( _message: { role: string; content: string } ): void { }
  markAssistantUnread (): void { }
  setSignalReady (): void { }
}
