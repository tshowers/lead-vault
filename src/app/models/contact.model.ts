/**
 * Copied from web-products/network's models/contact.model.ts (itself a
 * trimmed version of TODD's full Contact interface) and extended with the
 * extra fields lead-vault-full-record-page's mapLeadToContact() writes when
 * adding a purchased lead to TODD as a real Contact - fields Network's own
 * pages never needed (type, acquisitionSource, dateAdded, lastContacted,
 * recentCampaign, connectionDetails, engagements, interactions,
 * statusHistory, contactValue, subscriber, top-level email/sector/
 * linkedInUrl, and Company's description/phoneNumbers/emailAddresses/
 * other/url/sicCode/status/shared). Still grows field-by-field as needed,
 * not a full port of TODD's interface.
 */
export interface EmailAddress {
  emailAddress: string;
  emailAddressType?: string;
  blocked?: boolean;
  checked?: boolean;
}

export interface PhoneNumber {
  phoneNumber: string;
  phoneNumberType?: string;
}

export interface Address {
  addressType?: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  zip?: string;
  county?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

export interface SocialMedia {
  platform: string;
  url?: string;
  username?: string;
}

export interface Note {
  subject?: string;
  body?: string;
  lastUpdated?: string;
}

export interface ContactImage {
  src: string;
  alt?: string;
  _loadError?: boolean;
}

export interface Company {
  name?: string;
  url?: string;
  logoUrl?: string;
  publicInfo?: string;
  dba?: string;
  description?: string;
  numberOfEmployees?: string;
  sicCode?: string;
  capabilities?: string[];
  addresses?: Address[];
  phoneNumbers?: PhoneNumber[];
  emailAddresses?: EmailAddress[];
  products?: import( './product.model' ).Product[];
  other?: string;
  status?: string;
  shared?: boolean;
}

export interface ConnectionDetails {
  startDate?: string;
  mutualConnections?: number;
  transactionHistory?: any[];
}

export interface Contact {
  id?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  profession?: string;
  gender?: string;
  category?: string | string[];
  company?: Company;
  email?: string;
  emailAddresses?: EmailAddress[];
  phoneNumbers?: PhoneNumber[];
  socialMedia?: SocialMedia[];
  profileTypes?: string[];
  addresses?: Address[];
  notes?: Note[];
  images?: ContactImage[];
  lastUpdated?: string;
  important?: boolean;
  status?: string;
  emailStage?: string;
  nickname?: string;
  birthday?: string;
  linkedInUrl?: string;
  sector?: string;
  type?: string;
  acquisitionSource?: string;
  dateAdded?: string;
  lastContacted?: string;
  recentCampaign?: boolean;
  connectionDetails?: ConnectionDetails;
  engagements?: any[];
  interactions?: any[];
  statusHistory?: any[];
  contactValue?: number;
  subscriber?: boolean;
}
