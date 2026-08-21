// mobile/lib/flag-utils.ts
//
// Duplicated from data/lib/flag-utils.ts (already covered by
// data/lib/flag-utils.test.ts) — this repo keeps web and mobile data
// logic in separate, duplicated files (see mobile/lib/types.ts vs.
// data/lib/definitions.ts) rather than sharing a module between the two
// apps, and there's no mobile test runner to cover a mobile-side copy.
const REGIONAL_INDICATOR_OFFSET = 127397;

export function countryCodeToFlag(code: string | null): string | null {
  if (!code) return null;
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return null;

  const codePoints = normalized.split('').map((char) => REGIONAL_INDICATOR_OFFSET + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}
