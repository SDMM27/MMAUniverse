// Readable URL slugs for fighters ("Islam Makhachev" -> "islam-makhachev").
//
// There is no slug column: pages resolve a slug by slugifying `fighters.name`
// in SQL (data/lib/fighter-slug-data.ts). The SQL side cannot call
// String.normalize('NFD'), so it relies on a `translate()` over the explicit
// character table below. TS and SQL MUST stay in sync: both read
// SLUG_TRANSLATE_FROM / SLUG_TRANSLATE_TO, and slug.test.ts asserts that
// slugify() maps every character of that table exactly as translate() does.

// Accented Latin letters -> their ASCII base, generated once with NFD
// decomposition over the Latin blocks (Latin-1 Supplement .. Latin Extended-B,
// Latin Extended Additional). Letters NFD does not decompose are listed by hand.
const EXTRA_PAIRS: Array<[string, string]> = [
  ['ø', 'o'],
  ['ł', 'l'],
  ['đ', 'd'],
  ['ð', 'd'],
  ['ı', 'i'],
];

const COMBINING_MARK = /^[\u0300-\u036f]+$/;

function buildLowerTable(): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  for (let cp = 0xc0; cp <= 0x1eff; cp++) {
    if (cp > 0x24f && cp < 0x1e00) continue;
    const char = String.fromCodePoint(cp);
    if (char !== char.toLowerCase()) continue; // uppercase variants are added below
    const decomposed = char.normalize('NFD');
    const base = decomposed[0];
    if (decomposed.length > 1 && /[a-z]/.test(base) && COMBINING_MARK.test(decomposed.slice(1))) {
      pairs.push([char, base]);
    }
  }
  return [...pairs, ...EXTRA_PAIRS];
}

const LOWER_TABLE = buildLowerTable();

// Apostrophe-like characters, deleted ("O'Malley" -> "omalley").
export const SLUG_APOSTROPHES = "'’‘`´";
// Combining diacritics (decomposed input), also deleted.
const COMBINING_MARKS = Array.from({ length: 0x70 }, (_, i) => String.fromCodePoint(0x300 + i)).join('');

// Uppercase twins: only those that are a single, different character (toUpperCase can expand, e.g. ǰ).
const UPPER_TABLE = LOWER_TABLE.flatMap(([char, base]): Array<[string, string]> => {
  const upper = char.toUpperCase();
  return Array.from(upper).length === 1 && upper !== char ? [[upper, base]] : [];
});
const FULL_TABLE = [...LOWER_TABLE, ...UPPER_TABLE];

/**
 * Arguments of the SQL `translate(name, from, to)`: lower- and uppercase
 * accented letters mapped to their ASCII base. The apostrophes and combining
 * marks come last in `from` with no counterpart in `to`, which makes
 * translate() delete them.
 */
export const SLUG_TRANSLATE_FROM =
  FULL_TABLE.map(([char]) => char).join('') + SLUG_APOSTROPHES + COMBINING_MARKS;
export const SLUG_TRANSLATE_TO = FULL_TABLE.map(([, base]) => base).join('');
const DELETED_COUNT = Array.from(SLUG_APOSTROPHES + COMBINING_MARKS).length;
export const SLUG_TRANSLATE_DELETED_COUNT = DELETED_COUNT;

const TRANSLATE_FROM_CHARS = Array.from(SLUG_TRANSLATE_FROM);
const TRANSLATE_TO_CHARS = Array.from(SLUG_TRANSLATE_TO);
const TRANSLATE_MAP = new Map<string, string>(
  TRANSLATE_FROM_CHARS.map((char, index) => [char, TRANSLATE_TO_CHARS[index] ?? ''] as [string, string]),
);

/**
 * "Islam Makhachev" -> "islam-makhachev". Mirrors the SQL expression exactly
 * (translate() over the table above, lower(), runs of non-[a-z0-9] -> '-',
 * trimmed dashes), so a slug built here can be resolved in SQL.
 */
export function slugify(name: string | null | undefined): string {
  if (!name) return '';
  return Array.from(name)
    .map((char) => TRANSLATE_MAP.get(char) ?? char)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** True for URL segments that are plain database ids (legacy fighter URLs). */
export function isNumericSlug(value: string): boolean {
  return /^\d+$/.test(value);
}

/**
 * Link to a fighter page: readable slug when the name gives a usable one,
 * the numeric id otherwise (non-Latin names, missing name, or a name that
 * slugifies to digits only, which would be mistaken for an id). The id URL
 * redirects to the slug URL when possible, so it is always a safe fallback.
 */
export function fighterHref(fighter: { id: number | string; name?: string | null }): string {
  const slug = slugify(fighter.name);
  return slug && !isNumericSlug(slug) ? `/fighters/${slug}` : `/fighters/${fighter.id}`;
}
