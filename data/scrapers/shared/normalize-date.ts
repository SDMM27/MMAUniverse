const ISO_DATE_PREFIX = /^(\d{4}-\d{2}-\d{2})T/;
const ISO_DATETIME_PREFIX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

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

/**
 * Like `normalizeDate`, but keeps the full ISO 8601 datetime instead of just
 * the date portion — used for `events.start_time`, which needs the actual
 * kickoff time to lock picks accurately (see the pick'em design doc).
 */
export function normalizeStartTime(sherdogStartDate: string): string {
  const trimmed = sherdogStartDate.trim();
  if (!ISO_DATETIME_PREFIX.test(trimmed)) {
    throw new Error(`Unrecognized Sherdog start time format: "${sherdogStartDate}"`);
  }
  return trimmed;
}
