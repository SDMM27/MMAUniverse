// data/lib/flag-utils.ts
const REGIONAL_INDICATOR_OFFSET = 127397;

/**
 * Converts an ISO 3166-1 alpha-2 country code (e.g. 'FR') into its flag
 * emoji (🇫🇷) by mapping each letter to a Unicode regional indicator
 * symbol. Returns null for missing or malformed input so callers can skip
 * rendering a flag entirely.
 */
export function countryCodeToFlag(code: string | null): string | null {
  if (!code) return null;
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return null;

  const codePoints = [...normalized].map((char) => REGIONAL_INDICATOR_OFFSET + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}
