// data/scrapers/ranking-name-match.ts
//
// No fuzzy-matching utility exists elsewhere in this codebase -- resolveFighterIds
// in data/lib/data.ts and getFighterIdByName in app/seed/route.ts both do exact
// `name =` comparisons against Sherdog-sourced names. UFC.com's own athlete names
// can differ from Sherdog's in accenting/punctuation (e.g. curly vs straight
// apostrophes, missing diacritics) as well as in completeness -- ufc.com lists
// some fighters under a fuller name than the one Sherdog originally gave us
// (e.g. "Ian Machado Garry" on ufc.com vs "Ian Garry" in fighters.name), so
// ranking name-matching normalizes first and falls back to a word-subsequence
// check for that second case.

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
 * True if every word of `shorter` appears in `longer`, in the same relative
 * order (not necessarily adjacent) -- e.g. ["ian", "garry"] is a subsequence
 * of ["ian", "machado", "garry"]. Requires at least 2 words so a single
 * shared surname/first name alone can never count as a match on its own.
 */
function isWordSubsequence(shorter: string[], longer: string[]): boolean {
  if (shorter.length < 2 || shorter.length >= longer.length) return false;
  let i = 0;
  for (const word of longer) {
    if (word === shorter[i]) i += 1;
    if (i === shorter.length) return true;
  }
  return false;
}

/**
 * Matches a scraped ranking's fighter name against a list of candidate
 * fighters already in our DB. Tries exact normalized-name equality first,
 * then falls back to a word-subsequence match in either direction (handles a
 * fuller/updated name on one side, e.g. a middle name ufc.com now includes
 * that our stored name doesn't, or vice versa). Returns null (never throws)
 * on no match -- callers must tolerate this gracefully (store fighter_id =
 * NULL, still show the plain-text name); one unmatched name shouldn't fail
 * the whole sync.
 */
export function matchFighterByName<T extends { id: number; name: string }>(
  scrapedName: string,
  candidates: T[],
): T | null {
  const target = normalizeFighterName(scrapedName);
  const exact = candidates.find((candidate) => normalizeFighterName(candidate.name) === target);
  if (exact) return exact;

  const targetWords = target.split(' ');
  return (
    candidates.find((candidate) => {
      const candidateWords = normalizeFighterName(candidate.name).split(' ');
      return (
        isWordSubsequence(targetWords, candidateWords) || isWordSubsequence(candidateWords, targetWords)
      );
    }) ?? null
  );
}
