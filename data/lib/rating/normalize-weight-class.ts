// data/lib/rating/normalize-weight-class.ts
//
// Maps a UFCStats-sourced weight_class string (see data/scrapers/parse-ufcstats.ts's
// parseFightMeta) onto the same division labels rankings.weight_class already
// uses (scraped verbatim from ufc.com by sync-ufc-rankings.ts) -- needed so a
// fighter's computed FightScore groups into the *same* division buckets the
// official rankings/UI already use.
//
// Verified 2026-09-14 by fetching ufc.com/rankings directly (not guessed):
// the current set of real, actively-ranked per-division labels is exactly
// the 11 below, plus two Pound-for-Pound meta-categories ("Men's"/"Women's
// Pound-for-Pound Top Rank") that are never a per-fight weight class -- P4P
// is handled separately as a cross-division top-N, see the design spec's
// "Pound-for-Pound" section, not included here. UFCStats' own weight_class
// strings already match these exactly for every currently-active division --
// unlike fighter *names* (see ../../scrapers/ranking-name-match.ts), no
// fuzzy matching has been needed for those, so this stays a strict
// allow-list.
//
// "Women's Featherweight" added even though ufc.com/rankings shows no table
// for it today (the division's gone quiet, not officially retired) --
// confirmed 58 real historical UFCStats records exist for it (Cyborg-era
// title fights among them) once the full backfill ran; excluding it would
// silently drop real fight history rather than just not having a live
// champion to compare against (is_champion simply never matches for a
// division rankings.weight_class doesn't currently carry).
//
// "Interim " is stripped as a prefix (e.g. "Interim Lightweight" ->
// "Lightweight") -- confirmed via the same full backfill that UFCStats
// labels interim-title fights this way; they're real fights in the real
// division (a champion sidelined by injury, not a different weight class),
// dropping them would lose real fight history for no reason.
//
// Genuinely excluded (returns null): catchweight bouts ("Catch Weight"),
// "Open Weight", "Super Heavyweight", "Superfight Championship", and the
// long tail of one-off tournament-bracket labels from early UFC events and
// various "Ultimate Fighter" seasons (e.g. "Ultimate Fighter 14 Bantamweight
// Tournament", "Road to UFC 4 Lightweight Tournament") -- none of these are
// an ongoing division fighters carry a rating in across their career, they
// were confirmed by inspecting the full backfilled dataset's actual
// distinct weight_class values, not guessed.
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
  "Women's Featherweight",
] as const;

export type CanonicalWeightClass = (typeof CANONICAL_WEIGHT_CLASSES)[number];

const LOOKUP = new Set<string>(CANONICAL_WEIGHT_CLASSES);
const INTERIM_PREFIX = /^interim\s+/i;

/**
 * Normalizes a UFCStats-sourced weight_class string to the canonical label
 * rankings.weight_class uses, or null if it isn't (yet) one of the tracked
 * divisions. Never throws -- callers skip that fight/row on null, same
 * "never throws, tolerate null" convention matchFighterByName uses.
 */
export function normalizeWeightClass(rawWeightClass: string): CanonicalWeightClass | null {
  const trimmed = rawWeightClass.trim();
  if (LOOKUP.has(trimmed)) return trimmed as CanonicalWeightClass;

  const withoutInterim = trimmed.replace(INTERIM_PREFIX, '');
  return LOOKUP.has(withoutInterim) ? (withoutInterim as CanonicalWeightClass) : null;
}
