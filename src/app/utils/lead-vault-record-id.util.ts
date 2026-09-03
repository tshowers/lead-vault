const PLACEHOLDER_SEGMENT_PATTERN = /^\[[^\]]+\]$/;
const KNOWN_INVALID_RECORD_IDS = new Set( [
  'undefined',
  'null',
  'nan',
  'open-from-search',
] );

export function isInvalidLeadVaultRecordId ( recordId: string | null | undefined ): boolean {
  const normalizedId = ( recordId || '' ).trim().toLowerCase();

  if ( !normalizedId ) {
    return true;
  }

  if ( PLACEHOLDER_SEGMENT_PATTERN.test( normalizedId ) ) {
    return true;
  }

  if ( KNOWN_INVALID_RECORD_IDS.has( normalizedId ) ) {
    return true;
  }

  if ( normalizedId.includes( '[' ) || normalizedId.includes( ']' ) ) {
    return true;
  }

  return false;
}
