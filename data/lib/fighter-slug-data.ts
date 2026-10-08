import { sql } from '@/data/lib/db';
import { fetchFighterById } from '@/data/lib/data';
import { isNumericSlug, SLUG_TRANSLATE_FROM, SLUG_TRANSLATE_TO } from '@/data/lib/slug';

// Fighter URLs are readable slugs ("/fighters/islam-makhachev") but there is no
// slug column (and no migration): the slug is recomputed from `fighters.name`
// in SQL, with the same algorithm as slugify() in data/lib/slug.ts
//   translate(name, accents -> ascii, apostrophes/combining marks deleted)
//   -> lower() -> runs of non-[a-z0-9] become '-' -> trimmed dashes.

/**
 * The `fighters` row a slug stands for, shaped like fetchFighterById (so the
 * fighter page can use either). Null for an unknown or unusable slug.
 *
 * One real person has several rows (one per organisation, see
 * resolveFighterIds), and two different people can share a name. Among the
 * rows whose slug matches, the best one wins, deterministically:
 *   1. a row that has FightScore ratings,
 *   2. a UFC row,
 *   3. the row with the most recent fight (any event date, upcoming included),
 *   4. the lowest id.
 *
 * Cost: a full scan of `fighters` for the cheap `translate() LIKE '%w1%w2%'`
 * pre-filter (materialised, so the regexp and the ranking subqueries only run
 * on the few surviving rows). Acceptable at this table's size.
 */
export async function fetchFighterBySlug(slug: string) {
  const id = await fetchFighterIdBySlug(slug);
  return id === null ? null : fetchFighterById(String(id));
}

export async function fetchFighterIdBySlug(slug: string): Promise<number | null> {
  // Not a valid slug (also protects the LIKE pattern: only [a-z0-9-] gets through).
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || isNumericSlug(slug)) return null;
  const pattern = `%${slug.split('-').join('%')}%`;
  try {
    const data = await sql<{ id: number }>`
      WITH candidates AS MATERIALIZED (
        SELECT f.id, f.organization_id, lower(translate(f.name, ${SLUG_TRANSLATE_FROM}::text, ${SLUG_TRANSLATE_TO}::text)) AS folded
        FROM fighters f
        WHERE lower(translate(f.name, ${SLUG_TRANSLATE_FROM}::text, ${SLUG_TRANSLATE_TO}::text)) LIKE ${pattern}
      ),
      matched AS (
        SELECT c.id, c.organization_id
        FROM candidates c
        WHERE btrim(regexp_replace(c.folded, '[^a-z0-9]+', '-', 'g'), '-') = ${slug}
      )
      SELECT m.id
      FROM matched m
      JOIN organizations o ON o.id = m.organization_id
      ORDER BY
        EXISTS (SELECT 1 FROM fighter_ratings fr WHERE fr.fighter_id = m.id) DESC,
        (o.abbreviation = 'UFC') DESC,
        (
          SELECT MAX(e.date)
          FROM fights fi
          JOIN events e ON e.id = fi.event_id
          WHERE fi.fighter1_id = m.id OR fi.fighter2_id = m.id
        ) DESC NULLS LAST,
        m.id ASC
      LIMIT 1
    `;
    return data.rows[0]?.id ?? null;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch fighter by slug.');
  }
}

const SITEMAP_FIGHTER_LIMIT = 45000;

export type SitemapFighter = { id: number; name: string; last_date: string | null };

/**
 * One row per real fighter worth indexing: someone with at least one fight in
 * the tracked events or a FightScore. Deduplicated like fetchFighters (rows of
 * one person share a Sherdog URL, or failing that a name), keeping the row of
 * the most recent fight. Rated fighters first, then most recently active;
 * capped so the sitemap stays under the 50,000 URL limit.
 */
export async function fetchSitemapFighters(): Promise<SitemapFighter[]> {
  try {
    const data = await sql<SitemapFighter & { rated: boolean }>`
      WITH last_fight AS (
        SELECT x.fighter_id, MAX(e.date) AS last_date
        FROM (SELECT fighter1_id AS fighter_id, event_id FROM fights UNION ALL SELECT fighter2_id, event_id FROM fights) x
        JOIN events e ON e.id = x.event_id
        GROUP BY x.fighter_id
      ),
      rated AS (SELECT DISTINCT fighter_id FROM fighter_ratings),
      people AS (
        SELECT DISTINCT ON (COALESCE(f.sherdog_url, LOWER(f.name)))
          f.id, f.name, lf.last_date, (r.fighter_id IS NOT NULL) AS rated
        FROM fighters f
        LEFT JOIN last_fight lf ON lf.fighter_id = f.id
        LEFT JOIN rated r ON r.fighter_id = f.id
        WHERE lf.fighter_id IS NOT NULL OR r.fighter_id IS NOT NULL
        ORDER BY COALESCE(f.sherdog_url, LOWER(f.name)), (r.fighter_id IS NOT NULL) DESC, lf.last_date DESC NULLS LAST, f.id
      )
      SELECT id, name, last_date, rated
      FROM people
      ORDER BY rated DESC, last_date DESC NULLS LAST, id
      LIMIT ${SITEMAP_FIGHTER_LIMIT}
    `;
    return data.rows;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch sitemap fighters.');
  }
}

