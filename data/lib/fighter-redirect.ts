import { sql } from '@/data/lib/db';
import { isNumericSlug, slugify, SLUG_TRANSLATE_FROM, SLUG_TRANSLATE_TO } from '@/data/lib/slug';

// Edge-safe on purpose: imported by middleware.ts, so it may only depend on
// db.ts (neon HTTP driver), slug.ts and pure code (no react cache, no data.ts).

// Legacy numeric fighter URLs: "/fighters/11" (optional trailing slash).
const LEGACY_FIGHTER_PATH = /^\/fighters\/(\d{1,9})\/?$/;

/** The fighter id of a legacy "/fighters/<id>" pathname, null for any other path. */
export function legacyFighterIdFromPath(pathname: string): number | null {
  const match = LEGACY_FIGHTER_PATH.exec(pathname);
  return match ? Number(match[1]) : null;
}

export async function resolveFighterIds(fighterId: string): Promise<number[]> {
  const siblings = await sql<{ id: number }>`
    SELECT sibling.id
    FROM fighters self
    JOIN fighters sibling ON sibling.name = self.name
      AND (sibling.image_url = self.image_url OR (self.sherdog_url IS NOT NULL AND sibling.sherdog_url = self.sherdog_url))
    WHERE self.id = ${fighterId}
  `;
  const ids = siblings.rows.map((row) => row.id);
  return ids.length > 0 ? ids : [Number(fighterId)];
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

/**
 * The single decision rule for legacy numeric fighter URLs, used by both the
 * middleware (real HTTP 308) and resolveFighterRoute (in-page fallback):
 * the slug to redirect to, or null when the numeric URL must be served as is.
 * We redirect only when the slug resolves back to the same row or a sibling
 * row of the same person (homonyms and non-Latin names keep the numeric URL).
 */
export async function legacyRedirectSlug(fighter: { id: number; name: string | null }): Promise<string | null> {
  const slug = slugify(fighter.name);
  if (!slug || isNumericSlug(slug)) return null;
  const targetId = await fetchFighterIdBySlug(slug);
  if (targetId === null) return null;
  if (targetId === fighter.id) return slug;
  return (await resolveFighterIds(String(fighter.id))).includes(targetId) ? slug : null;
}

/** Middleware entry point: "/fighters/<id>" -> "/fighters/<slug>", or null (unknown id, no redirect). */
export async function legacyRedirectPathForId(id: number): Promise<string | null> {
  const data = await sql<{ id: number; name: string | null }>`SELECT id, name FROM fighters WHERE id = ${id}`;
  const fighter = data.rows[0];
  if (!fighter) return null;
  const slug = await legacyRedirectSlug(fighter);
  return slug ? `/fighters/${slug}` : null;
}
