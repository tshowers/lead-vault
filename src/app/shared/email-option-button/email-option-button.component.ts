import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Contact } from '../../models/contact.model';

/**
 * NOT a verbatim port of shared/page/email-option-button/email-option-button.component.ts
 * (253 lines) - that original's "Use 16Ahead" and "Email app" buttons both
 * route through composeWithAi(), which calls EmailService.
 * generateEmailDraftFromEditor() (an OpenAI-backed drafting call) and, for
 * contact lookup by bare email address, OutreachApiService. Both are real
 * Outreach-module services - discovered only by reading the file, since
 * the plan's working assumption (self-contained "by line count") didn't
 * hold once the imports were actually inspected. Pulling in AI email
 * drafting is out of scope for Lead Vault the same way the plan already
 * ruled out an in-app "compose email" route for it (Outreach isn't part
 * of either extracted product).
 *
 * This purpose-built replacement keeps the same two-button UI/CSS and the
 * same @Input/@Output surface the full-record page uses, but:
 *  - "Email app" opens a plain mailto: immediately, with a simple
 *    templated subject/body (lead name/company), no AI call.
 *  - "Use 16Ahead" still just emits composeIn16Ahead - the parent
 *    (LeadVaultFullRecordPageComponent) handles it with a cross-app link
 *    to the monorepo's own /compose-email, not an in-app AI draft.
 */
@Component( {
  selector: 'app-email-option-button',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './email-option-button.component.html',
  styleUrl: './email-option-button.component.css',
} )
export class EmailOptionButtonComponent {
  @Input() contact: Contact | null = null;
  @Input() emailAddress: string | undefined = undefined;
  @Input() displayMode: 'button' | 'icon' = 'button';

  @Output() composeIn16Ahead = new EventEmitter<{ contact: Contact | null; emailAddress: string | undefined; }>();

  onComposeIn16AheadClick ( event?: MouseEvent ): void {
    event?.stopPropagation();

    if ( !this.contact && !this.emailAddress ) return;

    this.composeIn16Ahead.emit( { contact: this.contact, emailAddress: this.emailAddress } );
  }

  onComposeInNativeClick ( event?: MouseEvent ): void {
    event?.stopPropagation();

    const to = ( this.contact?.email || this.emailAddress || '' ).trim();
    if ( !to ) return;

    const name = [this.contact?.firstName, this.contact?.lastName].filter( Boolean ).join( ' ' ).trim();
    const company = ( this.contact?.company?.name || '' ).trim();
    const subject = company ? `Following up - ${company}` : 'Following up';
    const body = name ? `Hi ${name},\n\n` : '';

    const mailtoUrl = `mailto:${encodeURIComponent( to )}?subject=${encodeURIComponent( subject )}&body=${encodeURIComponent( body )}`;
    window.location.href = mailtoUrl;
  }
}
