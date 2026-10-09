/**
 * Lead Vault Match (design_handoff_lead_vault_match). Two ways in, one
 * results screen: "match" scores the vault against a company you enter,
 * "criteria" skips the company and scores against the criteria alone.
 */
export type MatchPath = 'match' | 'criteria';

/** Form = 5b stepper with the sticky rail; guided = 5d one question at a time. */
export type CriteriaView = 'form' | 'guided';

export type MatchRadius = 25 | 50 | 100;

export const RADIUS_OPTIONS: MatchRadius[] = [ 25, 50, 100 ];

export interface MatchLocation {
  label: string;
  lat: number;
  lng: number;
}

export interface MatchCriteria {
  location: MatchLocation | null;
  /** null = Anywhere. Ignored without a location. */
  radius: MatchRadius | null;
  industries: string[];
  naics: string[];
  certifications: string[];
  /** Comma-separated phrases, searched in company profiles. */
  keywords: string;
}

export const EMPTY_CRITERIA: MatchCriteria = {
  location: null,
  radius: null,
  industries: [],
  naics: [],
  certifications: [],
  keywords: '',
};

export interface MatchCompany {
  name: string;
  url: string;
  description: string;
  /** NAICS codes the company holds; offered as one-click criteria. */
  naics: string[];
}

export interface VocabularyEntry {
  value: string;
  count: number;
}

export interface MatchVocabulary {
  industries: VocabularyEntry[];
  certifications: VocabularyEntry[];
  /** NAICS code -> companies carrying it. */
  naics: Record<string, number>;
}

export interface MatchResult {
  id: string;
  teaserCompanyName: string;
  teaserName: string;
  teaserTitle: string;
  teaserLocation: string;
  sector: string;
  emailMasked: string;
  score: number;
  matchReasons: string[];
  distanceMiles: number | null;
  contactCount: number;
}

export interface MatchSearchResponse {
  total: number;
  offset: number;
  limit: number;
  results: MatchResult[];
  hasMore: boolean;
  /** Signed-out visitor and more matches exist: they only ever get page one. */
  moreRequiresSignIn?: boolean;
}

export interface BestMatch extends MatchResult {
  reason: string;
}

export interface NaicsOption {
  code: string;
  title: string;
}
