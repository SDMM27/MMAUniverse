// data/lib/rating/normalize-weight-class.ts
//
// Maps a UFCStats-sourced weight_class string (see data/scrapers/parse-ufcstats.ts's
// parseFightMeta) onto the same division labels rankings.weight_class already
// uses (scraped verbatim from ufc.com by sync-ufc-rankings.ts) -- needed so a
// fighter's computed FightScore groups into the *same* division buckets the
// official rankings/UI already use.
//
// Verified 2026-09-14 by fetching ufc.com/rankings directly (not guessed):
// the current set of real per-division labels is exactly the 11 below, plus
// two Pound-for-Pound meta-categories ("Men's"/"Women's Pound-for-Pound Top
// Rank") that are never a per-fight weight class -- P4P is handled
// separately as a cross-division top-N, see the design spec's
// "Pound-for-Pound" section, not included here. UFCStats' own weight_class
// strings already match these exactly for every real division seen so far --
// unlike fighter *names* (see ../../scrapers/ranking-name-match.ts), no
// fuzzy matching has been needed in practice, so this stays a strict
// allow-list: an unrecognized string (a catchweight bout -- UFCStats prints
// "Catch Weight" -- or a defunct/historical class from early-90s UFC events,
// e.g. "Open Weight") returns null rather than being silently misfiled into
// a real division.
const CANONICAL_WEIGHT_CLASSES = [
  'Flyweight',
  'Bantamweight',
  'Featherweight',
  'Lightweight',
  'Welterweight',
  'Middleweight',
  'Light Heavyweight',
  'Heavyweight',
  "Women's Strawweight",
  "Women's Flyweight",
  "Women's Bantamweight",
] as const;

export type CanonicalWeightClass = (typeof CANONICAL_WEIGHT_CLASSES)[number];

const LOOKUP = new Set<string>(CANONICAL_WEIGHT_CLASSES);

/**
 * Normalizes a UFCStats-sourced weight_class string to the canonical label
 * rankings.weight_class uses, or null if it isn't (yet) one of the tracked
 * divisions. Never throws -- callers skip that fight/row on null, same
 * "never throws, tolerate null" convention matchFighterByName uses.
 */
export function normalizeWeightClass(rawWeightClass: string): CanonicalWeightClass | null {
  const trimmed = rawWeightClass.trim();
  return LOOKUP.has(trimmed) ? (trimmed as CanonicalWeightClass) : null;
}
