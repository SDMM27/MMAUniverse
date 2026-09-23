// data/scrapers/ranking-name-match.ts
//
// No fuzzy-matching utility exists elsewhere in this codebase -- resolveFighterIds
// in data/lib/data.ts and getFighterIdByName in app/seed/route.ts both do exact
// `name =` comparisons against Sherdog-sourced names. UFC.com's and UFCStats'
// names often differ from Sherdog's (our fighters.name): accents/punctuation
// ("Benoît" / "Waldo Cortes-Acosta"), "St." vs "Saint", Jr./III suffixes,
// Asian family-name order ("Zhang Weili" / "Weili Zhang"), joined given names
// ("JunYong Park" / "Jun Yong Park"), fuller names ("Ian Machado Garry" /
// "Ian Garry"), short first names ("Phil Rowe" / "Philip Rowe") and ring
// names ("Renato Moicano" / "Renato Carneiro"). A missed match silently drops
// every fight of that fighter -- and the matching fight of each opponent --
// from FightScore, so matching goes through increasingly loose levels, and
// only accepts a level's result when it is unique.

/** Lowercases, strips diacritics and punctuation, collapses whitespace. */
export function normalizeFighterName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritical marks
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const NAME_SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv']);

/**
 * Words of a name for fuzzy comparison: like normalizeFighterName, except
 * hyphens separate words ("Cortes-Acosta", "St-Pierre"), "st" reads as
 * "saint" and generational suffixes are dropped.
 */
function nameWords(name: string): string[] {
  return normalizeFighterName(name.replace(/[-‐‑–]/g, ' '))
    .split(' ')
    .filter((word) => word && !NAME_SUFFIXES.has(word))
    .map((word) => (word === 'st' ? 'saint' : word));
}

/**
 * Ring names and nicknames the other levels can't infer: the name used by
 * UFC.com / UFCStats (normalized) -> fighters.name (normalized).
 */
const NAME_ALIASES: Record<string, string> = {
  'renato moicano': 'renato carneiro',
  'patricio pitbull': 'patricio freire',
  'loopy godinez': 'lupita godinez',
  'shara magomedov': 'sharabutdin magomedov',
  'jacare souza': 'ronaldo souza',
  'bia mesquita': 'beatriz mesquita',
  'daria zhelezniakova': 'darya zheleznyakova',
  'viktoriia dudakova': 'victoria dudakova',
  'chepe mariscal': 'jose mariscal',
  'tuco tokkos': 'george tokkos',
  'ozzy diaz': 'osman diaz',
  'ollie schmid': 'oliver schmid',
  'tommy gantt': 'thomas gantt',
  'gigi canuto': 'giovanna canuto',
  'timmy cuamba': 'timothy cuamba',
  'maheshate': 'maheshate hayisaer',
  'mizuki': 'mizuki inoue',
};

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

/** Same surname(s), and first names that share their first 3 letters ("phil"/"philip", "zach"/"zachary"). */
function isShortFirstName(a: string[], b: string[]): boolean {
  if (a.length < 2 || a.length !== b.length) return false;
  if (a.slice(1).join(' ') !== b.slice(1).join(' ')) return false;
  const [first, other] = [a[0], b[0]];
  return first !== other && first.length >= 3 && other.length >= 3 && first.slice(0, 3) === other.slice(0, 3);
}

type Level = (target: string[], candidate: string[]) => boolean;

const MATCH_LEVELS: Level[] = [
  (t, c) => t.join(' ') === c.join(' '),
  (t, c) => t.join('') === c.join(''), // "junyong park" / "jun yong park", "sangchaan" / "sangcha an"
  (t, c) => [...t].sort().join(' ') === [...c].sort().join(' '), // family-name order
  (t, c) => isWordSubsequence(t, c) || isWordSubsequence(c, t),
  isShortFirstName,
];

/**
 * Matches a scraped fighter name against a list of candidate fighters already
 * in our DB. Tries exact normalized-name equality, then a known alias, then
 * looser levels (see MATCH_LEVELS), stopping at the first level with any
 * candidate: a unique candidate is the match, several mean ambiguous (null,
 * rather than guessing between two people). Returns null (never throws) on no
 * match -- callers must tolerate this gracefully (store fighter_id = NULL,
 * still show the plain-text name); one unmatched name shouldn't fail the
 * whole sync.
 */
export function matchFighterByName<T extends { id: number; name: string }>(
  scrapedName: string,
  candidates: T[],
): T | null {
  const target = normalizeFighterName(scrapedName);
  const exact = candidates.find((candidate) => normalizeFighterName(candidate.name) === target);
  if (exact) return exact;

  const alias = NAME_ALIASES[target];
  if (alias) {
    const aliased = candidates.filter((candidate) => normalizeFighterName(candidate.name) === alias);
    if (aliased.length === 1) return aliased[0];
  }

  const targetWords = nameWords(scrapedName);
  const candidateWords = candidates.map((candidate) => nameWords(candidate.name));
  for (const level of MATCH_LEVELS) {
    const matches = candidates.filter((_, i) => level(targetWords, candidateWords[i]));
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) return null;
  }
  return null;
}
