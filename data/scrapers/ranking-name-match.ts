// data/scrapers/ranking-name-match.ts
//
// No fuzzy-matching utility exists elsewhere in this codebase -- resolveFighterIds
// in data/lib/data.ts and getFighterIdByName in app/seed/route.ts both do exact
// `name =` comparisons against Sherdog-sourced names. UFC.com's own athlete names
// can differ in accenting/punctuation from Sherdog's (e.g. curly vs straight
// apostrophes, missing diacritics), so ranking name-matching normalizes first.

/** Lowercases, strips diacritics and punctuation, collapses whitespace. */
export function normalizeFighterName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritical marks
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Matches a scraped ranking's fighter name against a list of candidate
 * fighters already in our DB, by normalized-name equality. Returns null
 * (never throws) on no match -- callers must tolerate this gracefully
 * (store fighter_id = NULL, still show the plain-text name); one unmatched
 * name shouldn't fail the whole sync.
 */
export function matchFighterByName<T extends { id: number; name: string }>(
  scrapedName: string,
  candidates: T[],
): T | null {
  const target = normalizeFighterName(scrapedName);
  return candidates.find((candidate) => normalizeFighterName(candidate.name) === target) ?? null;
}
