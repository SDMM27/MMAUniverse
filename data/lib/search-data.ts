import { sql } from '@/data/lib/db';
import { containsPattern, prefixPattern } from '@/data/lib/search-utils';
import type { SearchEvent, SearchFighter, SearchOrganization } from '@/data/lib/search-utils';

// Same dedup as fetchFighters (data/lib/data.ts): the scraper keeps one `fighters` row per
// organization, so rows sharing a Sherdog URL (or, without one, a name) collapse into the row
// of the organization they fought for most recently. Matches are ranked name-prefix first, then
// FightScore, then most recent fight.
export async function searchFighters(query: string, limit: number): Promise<SearchFighter[]> {
  const today = new Date().toISOString().slice(0, 10);
  const like = containsPattern(query);
  const prefix = prefixPattern(query);
  const data = await sql<SearchFighter>`
    WITH matched AS (
      SELECT id FROM fighters WHERE name ILIKE ${like}
    ),
    last_fight AS (
      SELECT x.fighter_id, MAX(e.date) AS last_date
      FROM (
        SELECT fighter1_id AS fighter_id, event_id FROM fights WHERE fighter1_id IN (SELECT id FROM matched)
        UNION ALL
        SELECT fighter2_id, event_id FROM fights WHERE fighter2_id IN (SELECT id FROM matched)
      ) x
      JOIN events e ON e.id = x.event_id
      WHERE e.date <= ${today}
      GROUP BY x.fighter_id
    ),
    score AS (
      SELECT fighter_id, MAX(display_score) AS score, MAX(p4p_score) AS p4p
      FROM fighter_ratings
      WHERE is_ranking_eligible = true AND fighter_id IN (SELECT id FROM matched)
      GROUP BY fighter_id
    ),
    people AS (
      SELECT DISTINCT ON (COALESCE(f.sherdog_url, LOWER(f.name)))
        f.id, f.name, f.image_url, f.nationality, f.weight_class, f.record,
        o.abbreviation AS organization_abbreviation,
        lf.last_date, sc.score, sc.p4p
      FROM fighters f
      JOIN matched m ON m.id = f.id
      JOIN organizations o ON f.organization_id = o.id
      LEFT JOIN last_fight lf ON lf.fighter_id = f.id
      LEFT JOIN score sc ON sc.fighter_id = f.id
      ORDER BY COALESCE(f.sherdog_url, LOWER(f.name)), lf.last_date DESC NULLS LAST, f.id
    )
    SELECT id, name, image_url, nationality, weight_class, record, organization_abbreviation
    FROM people
    ORDER BY CASE WHEN name ILIKE ${prefix} THEN 0 ELSE 1 END,
             score DESC NULLS LAST, p4p DESC NULLS LAST, last_date DESC NULLS LAST, name ASC
    LIMIT ${limit}
  `;
  return data.rows;
}

// Upcoming events first (soonest first), then past ones (most recent first). `date` is an ISO
// YYYY-MM-DD string, compared as text like elsewhere in data.ts.
export async function searchEvents(query: string, limit: number): Promise<SearchEvent[]> {
  const today = new Date().toISOString().slice(0, 10);
  const like = containsPattern(query);
  const data = await sql<SearchEvent>`
    SELECT e.id, e.name, e.date, e.event_poster, o.abbreviation AS organization_abbreviation
    FROM events e
    LEFT JOIN organizations o ON e.organization_id = o.id
    WHERE e.name ILIKE ${like}
    ORDER BY CASE WHEN e.date >= ${today} THEN 0 ELSE 1 END,
             CASE WHEN e.date >= ${today} THEN e.date END ASC,
             e.date DESC,
             e.id DESC
    LIMIT ${limit}
  `;
  return data.rows;
}

export async function searchOrganizations(query: string, limit: number): Promise<SearchOrganization[]> {
  const like = containsPattern(query);
  const prefix = prefixPattern(query);
  const data = await sql<SearchOrganization>`
    SELECT id, name, abbreviation, logo_link
    FROM organizations
    WHERE name ILIKE ${like} OR abbreviation ILIKE ${like}
    ORDER BY CASE WHEN abbreviation ILIKE ${prefix} OR name ILIKE ${prefix} THEN 0 ELSE 1 END, name ASC
    LIMIT ${limit}
  `;
  return data.rows;
}
