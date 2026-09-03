import { Injectable } from '@angular/core';
import {
  addDoc,
  collection,
  doc,
  getDocs,
  getFirestore,
  limit,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';

import { Contact } from '../models/contact.model';

/**
 * Trimmed, Firestore-direct data layer for the standalone Lead Vault app -
 * copied from web-products/network's NetworkDataService, keeping only
 * addContact() (the one write the full-record page's "Add to TODD" action
 * needs) plus a new getContactIdByEmail() lookup, added because the
 * monorepo original's addToTodd() de-dupes against an existing contact by
 * email first (DataService.getRecordIdIfExists) before writing - Network
 * never needed that lookup, so it isn't in NetworkDataService to copy.
 * This app has no contact-list/view of its own, so nothing else from
 * NetworkDataService's fuller surface (getAllContacts, updateContact,
 * realtime reads, csv bulk upload) is needed here.
 */
@Injectable( { providedIn: 'root' } )
export class LeadVaultDataService {
  private get firestore () {
    return getFirestore();
  }

  private contactsRef ( tenantId: string ) {
    return collection( this.firestore, `tenants/${tenantId}/contacts` );
  }

  /** Mirrors DataService.getRecordIdIfExists(email, tenantId), trimmed (no Cypress override). */
  async getContactIdByEmail ( tenantId: string, email: string ): Promise<string | undefined> {
    if ( !tenantId || !email ) return undefined;

    const q = query( this.contactsRef( tenantId ), where( 'email', '==', email ), limit( 1 ) );
    const snap = await getDocs( q );
    return snap.empty ? undefined : snap.docs[0].id;
  }

  /**
   * Mirrors DataService.addDocument('CONTACTS', ...): add, then patch the
   * new doc with its own id (TODD stores id redundantly inside the document
   * itself, not just as the Firestore doc id).
   */
  async addContact ( tenantId: string, data: Partial<Contact> ): Promise<string> {
    const ref = this.contactsRef( tenantId );
    const docRef = await addDoc( ref, data );
    await updateDoc( doc( ref, docRef.id ), { id: docRef.id } );
    return docRef.id;
  }
}
