const ISO_DATE_PREFIX = /^(\d{4}-\d{2}-\d{2})T/;

/**
 * Sherdog exposes every date as machine-readable ISO 8601 in
 * `<meta itemprop="startDate" content="...">`. This just extracts the
 * 'YYYY-MM-DD' portion and validates the shape — it does not parse
 * arbitrary human-readable dates.
 */
export function normalizeDate(sherdogStartDate: string): string {
  const match = ISO_DATE_PREFIX.exec(sherdogStartDate.trim());
  if (!match) {
    throw new Error(`Unrecognized Sherdog date format: "${sherdogStartDate}"`);
  }
  return match[1];
}
