import { sql } from '@/data/lib/db';
import {
    Organization,
    Event,
    Fighter,
    FightHistoryEntry,
    FightWithFighters,
    FightResultWithContext,
    Ranking,
    RankingWithFighter,
  } from './definitions';

export async function fetchOrganizations() {
    try {
      // Artificially delay a response for demo purposes.
      // Don't do this in production :)
  
      // console.log('Fetching revenue data...');
      // await new Promise((resolve) => setTimeout(resolve, 3000));
  
      const data = await sql<Organization>`SELECT * FROM organizations`;
  
      // console.log('Data fetch completed after 3 seconds.');
  
      return data.rows;
    } catch (error) {
      console.error('Database Error:', error);
      throw new Error('Failed to fetch revenue data.');
    }
  }

  export async function fetchEventsByOrg(orgId: string) {
    try {
      // Artificially delay a response for demo purposes.
      // Don't do this in production :)
  
      // console.log('Fetching revenue data...');
      // await new Promise((resolve) => setTimeout(resolve, 3000));
  
      const data = await sql<Event>`SELECT * FROM Events WHERE organization_id = ${orgId}`;

      // console.log('Data fetch completed after 3 seconds.');

      return data.rows;
    } catch (error) {
      console.error('Database Error:', error);
      throw new Error('Failed to fetch revenue data.');
    }
  }

export async function fetchAllEvents() {
  try {
    const data = await sql<Event & { organization_abbreviation: string }>`
      SELECT e.*, o.abbreviation AS organization_abbreviation
      FROM events e
      JOIN organizations o ON e.organization_id = o.id
      ORDER BY e.date ASC
    `;
    return data.rows;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch events.');
  }
}

export async function fetchOrganizationById(id: string) {
  try {
    const data = await sql<Organization>`SELECT * FROM organizations WHERE id = ${id}`;
    return data.rows[0] ?? null;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch organization.');
  }
}

export async function fetchEventById(id: string) {
  try {
    const data = await sql<Event & { organization_abbreviation: string }>`
      SELECT e.*, o.abbreviation AS organization_abbreviation
      FROM events e
      JOIN organizations o ON e.organization_id = o.id
      WHERE e.id = ${id}
    `;
    return data.rows[0] ?? null;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch event.');
  }
}

export async function fetchFightsByEvent(eventId: string) {
  try {
    const data = await sql<{
      id: number;
      event_id: number;
      fighter1_id: number;
      fighter2_id: number;
      fight_finished: boolean;
      winner_id: number | null;
      method: string;
      round: number;
      time: string;
      weight_class: string;
      is_main_event: boolean;
      is_title_fight: boolean;
      f1_id: number | null;
      f1_name: string | null;
      f1_image_url: string | null;
      f1_weight_class: string | null;
      f1_organization_id: number | null;
      f1_record: string | null;
      f1_ranking: number | null;
      f1_nationality: string | null;
      f2_id: number | null;
      f2_name: string | null;
      f2_image_url: string | null;
      f2_weight_class: string | null;
      f2_organization_id: number | null;
      f2_record: string | null;
      f2_ranking: number | null;
      f2_nationality: string | null;
    }>`
      SELECT
        f.id, f.event_id, f.fighter1_id, f.fighter2_id, f.fight_finished, f.winner_id, f.method, f.round, f.time, f.weight_class, f.is_main_event, f.is_title_fight,
        f1.id AS f1_id, f1.name AS f1_name, f1.image_url AS f1_image_url, f1.weight_class AS f1_weight_class, f1.organization_id AS f1_organization_id, f1.record AS f1_record, f1.ranking AS f1_ranking, f1.nationality AS f1_nationality,
        f2.id AS f2_id, f2.name AS f2_name, f2.image_url AS f2_image_url, f2.weight_class AS f2_weight_class, f2.organization_id AS f2_organization_id, f2.record AS f2_record, f2.ranking AS f2_ranking, f2.nationality AS f2_nationality
      FROM fights f
      LEFT JOIN fighters f1 ON f.fighter1_id = f1.id
      LEFT JOIN fighters f2 ON f.fighter2_id = f2.id
      WHERE f.event_id = ${eventId}
      ORDER BY f.is_main_event DESC, f.id ASC
    `;

    return data.rows.map((row) => ({
      id: row.id,
      event_id: row.event_id,
      fighter1_id: row.fighter1_id,
      fighter2_id: row.fighter2_id,
      fight_finished: row.fight_finished,
      winner_id: row.winner_id,
      method: row.method,
      round: row.round,
      time: row.time,
      weight_class: row.weight_class,
      is_main_event: row.is_main_event,
      is_title_fight: row.is_title_fight,
      fighter1: row.f1_id
        ? {
            id: row.f1_id,
            name: row.f1_name,
            image_url: row.f1_image_url,
            weight_class: row.f1_weight_class,
            organization_id: row.f1_organization_id,
            record: row.f1_record,
            ranking: row.f1_ranking,
            nationality: row.f1_nationality,
          }
        : null,
      fighter2: row.f2_id
        ? {
            id: row.f2_id,
            name: row.f2_name,
            image_url: row.f2_image_url,
            weight_class: row.f2_weight_class,
            organization_id: row.f2_organization_id,
            record: row.f2_record,
            ranking: row.f2_ranking,
            nationality: row.f2_nationality,
          }
        : null,
    })) as FightWithFighters[];
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch fights for event.');
  }
}

// Unpaginated full roster for the org hub's Fighters tab -- distinct from the
// paginated, searchable fetchFighters() below (which backs the global
// /fighters page and can't afford an unbounded SELECT at that table's
// scale). Mirrors fetchEventsByOrg's shape.
export async function fetchFightersByOrg(organizationId: string) {
  try {
    const data = await sql<Fighter & { organization_abbreviation: string }>`
      SELECT f.*, o.abbreviation AS organization_abbreviation
      FROM fighters f
      JOIN organizations o ON f.organization_id = o.id
      WHERE f.organization_id = ${organizationId}
      ORDER BY f.name ASC
    `;
    return data.rows;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch organization roster.');
  }
}

// Ordered by id ASC -- relies on the scraper's delete-then-reinsert-per-org
// strategy inserting rows in the order encountered on the page (division by
// division, champion then contenders 1-15), which reproduces the org's own
// display order for free. groupRankingsByWeightClass (data/lib/ranking-utils.ts)
// depends on that order.
export async function fetchRankingsByOrg(organizationId: string) {
  try {
    const data = await sql<RankingWithFighter>`
      SELECT r.*, f.image_url AS fighter_image_url, f.record AS fighter_record
      FROM rankings r
      LEFT JOIN fighters f ON r.fighter_id = f.id
      WHERE r.organization_id = ${organizationId}
      ORDER BY r.id ASC
    `;
    return data.rows;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch rankings.');
  }
}

// For the fighter detail page's ranking pill -- a fighter can hold more than
// one ranking row (weight class + Pound-for-Pound), so this returns all of
// them and lets the caller pick which to surface.
export async function fetchFighterRankings(fighterId: string) {
  try {
    const data = await sql<Ranking>`
      SELECT * FROM rankings WHERE fighter_id = ${fighterId} ORDER BY rank ASC
    `;
    return data.rows;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch fighter ranking.');
  }
}

// Backs the /rankings index -- only organizations that actually have ranking
// data get listed, so the orgs without a scraper yet don't show as empty
// tiles. The layout scales automatically as more orgs get scrapers later.
export async function fetchRankedOrganizations() {
  try {
    const data = await sql<Organization>`
      SELECT DISTINCT o.* FROM organizations o
      JOIN rankings r ON r.organization_id = o.id
      ORDER BY o.name ASC
    `;
    return data.rows;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch ranked organizations.');
  }
}

export async function fetchAllFighters() {
  try {
    const data = await sql<Fighter & { organization_abbreviation: string }>`
      SELECT f.*, o.abbreviation AS organization_abbreviation
      FROM fighters f
      JOIN organizations o ON f.organization_id = o.id
      ORDER BY f.name ASC
    `;
    return data.rows;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch fighters.');
  }
}

// Paginated, searchable fighters query for the /fighters page — fetchAllFighters()
// above loads the entire table and stays that way for the mobile API, which does
// its own client-side filtering, but the web page can't afford an unbounded
// SELECT once the fighters table grows into the thousands.
export async function fetchFighters({
  query = '',
  organizationId = null,
  page = 1,
  pageSize = 24,
}: {
  query?: string;
  organizationId?: number | null;
  page?: number;
  pageSize?: number;
}) {
  try {
    const offset = (page - 1) * pageSize;
    const likeTerm = `%${query}%`;

    const data = await sql<Fighter & { organization_abbreviation: string; total_count: string }>`
      SELECT f.*, o.abbreviation AS organization_abbreviation, COUNT(*) OVER() AS total_count
      FROM fighters f
      JOIN organizations o ON f.organization_id = o.id
      WHERE (${query} = '' OR f.name ILIKE ${likeTerm})
        AND (${organizationId}::int IS NULL OR f.organization_id = ${organizationId})
      ORDER BY f.name ASC
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    const total = data.rows.length > 0 ? Number(data.rows[0].total_count) : 0;
    return { fighters: data.rows, total };
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch fighters.');
  }
}

export async function fetchFighterById(id: string) {
  try {
    const data = await sql<Fighter & { organization_abbreviation: string }>`
      SELECT f.*, o.abbreviation AS organization_abbreviation
      FROM fighters f
      JOIN organizations o ON f.organization_id = o.id
      WHERE f.id = ${id}
    `;
    return data.rows[0] ?? null;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch fighter.');
  }
}

// The scraper stores one `fighters` row per organization a fighter has
// appeared in (same name + image_url, different id/organization_id), since
// each org's roster is scraped independently. A fighter who moved between
// orgs (e.g. Bellator -> UFC) therefore has several ids, and their fights
// are split across those ids' rows. To show a fighter's full history we
// first resolve every sibling id that represents the same real person.
// `sherdog_url` is included alongside name+image_url once a row has it
// (backfilled by data/scrapers/sync-fighter-history.ts) — it's a more
// reliable match than image_url, which can legitimately change between two
// independent scrapes if Sherdog swaps a fighter's photo.
async function resolveFighterIds(fighterId: string): Promise<number[]> {
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

// A fighter's page combines two independent sources:
//  - upcoming (not-yet-fought) bouts, still read from our own `fights`/`events`
//    tables — Sherdog's fight history table only ever lists completed fights,
//    so this is the one thing it can't give us.
//  - every completed fight, read from `fighter_fight_history` — scraped
//    directly off the fighter's own Sherdog page, so it's complete across
//    every organization Sherdog knows about, not just the ones we track. This
//    is what fixes a fighter having no history right after transferring into
//    a tracked org from one we've never scraped (see data/scrapers/parse.ts's
//    parseFighterFightHistory).
export async function fetchFighterFightHistory(fighterId: string) {
  try {
    const fighterIds = await resolveFighterIds(fighterId);

    const upcoming = await sql<{
      id: number;
      event_id: number;
      event_name: string;
      event_date: string;
      opponent_id: number | null;
      opponent_name: string | null;
      opponent_image_url: string | null;
    }>`
      SELECT
        f.id, f.event_id,
        e.name AS event_name, e.date AS event_date,
        opponent.id AS opponent_id, opponent.name AS opponent_name, opponent.image_url AS opponent_image_url
      FROM fights f
      JOIN events e ON f.event_id = e.id
      LEFT JOIN fighters opponent ON opponent.id = (
        CASE WHEN f.fighter1_id = ANY(${fighterIds}) THEN f.fighter2_id ELSE f.fighter1_id END
      )
      WHERE (f.fighter1_id = ANY(${fighterIds}) OR f.fighter2_id = ANY(${fighterIds}))
        AND f.fight_finished = false
      ORDER BY e.date ASC
    `;

    const history = await sql<{
      id: number;
      opponent_name: string;
      opponent_sherdog_url: string | null;
      event_name: string;
      event_date: string | null;
      event_sherdog_url: string | null;
      event_id: number | null;
      opponent_id: number | null;
      result: string;
      method: string | null;
      referee: string | null;
      round: number | null;
      time: string | null;
    }>`
      SELECT
        fhh.id, fhh.opponent_name, fhh.opponent_sherdog_url, fhh.event_name, fhh.event_date, fhh.event_sherdog_url,
        fhh.result, fhh.method, fhh.referee, fhh.round, fhh.time,
        (
          SELECT e.id FROM events e WHERE e.name = fhh.event_name ORDER BY e.id ASC LIMIT 1
        ) AS event_id,
        (
          SELECT fi.id FROM fighters fi
          WHERE fhh.opponent_sherdog_url IS NOT NULL AND fi.sherdog_url = fhh.opponent_sherdog_url
          ORDER BY fi.id ASC LIMIT 1
        ) AS opponent_id
      FROM fighter_fight_history fhh
      WHERE fhh.fighter_id = ANY(${fighterIds})
      ORDER BY fhh.event_date DESC NULLS LAST
    `;

    // Sibling fighter rows above share the exact same Sherdog page, so their
    // fighter_fight_history rows are identical — de-dupe by the natural
    // (event, opponent) key rather than showing the same fight twice.
    const seen = new Set<string>();
    const dedupedHistory = history.rows.filter((row) => {
      const key = `${row.event_name}::${row.opponent_name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const upcomingEntries: FightHistoryEntry[] = upcoming.rows.map((row) => ({
      id: `upcoming-${row.id}`,
      event_id: row.event_id,
      event_name: row.event_name,
      event_date: row.event_date,
      event_sherdog_url: null,
      opponent_id: row.opponent_id,
      opponent_name: row.opponent_name,
      opponent_image_url: row.opponent_image_url,
      opponent_sherdog_url: null,
      result: 'upcoming',
      method: null,
      referee: null,
      round: null,
      time: null,
    }));

    const historyEntries: FightHistoryEntry[] = dedupedHistory.map((row) => ({
      id: `history-${row.id}`,
      // Matched by name against our own `events` table (same natural key
      // getEventIdByName/dedupe-seed-duplicates.ts use elsewhere) — a
      // fighter_fight_history row for an event we already track (e.g. it was
      // synced in while upcoming and has since happened) should still link to
      // our internal event page, not fall through to Sherdog.
      event_id: row.event_id,
      event_name: row.event_name,
      event_date: row.event_date ?? '',
      event_sherdog_url: row.event_sherdog_url,
      // Matched by opponent_sherdog_url against fighters.sherdog_url — see
      // the FightHistoryEntry doc comment in definitions.ts for why this is
      // preferred over matching on opponent_name.
      opponent_id: row.opponent_id,
      opponent_name: row.opponent_name,
      opponent_image_url: null,
      opponent_sherdog_url: row.opponent_sherdog_url,
      result: (row.result as FightHistoryEntry['result']) ?? 'draw',
      method: row.method,
      referee: row.referee,
      round: row.round,
      time: row.time,
    }));

    return [...upcomingEntries, ...historyEntries];
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch fight history.');
  }
}

export async function fetchRecentFinishedFights(limit: number) {
  try {
    const data = await sql<{
      id: number;
      event_id: number;
      fighter1_id: number;
      fighter2_id: number;
      fight_finished: boolean;
      winner_id: number | null;
      method: string;
      round: number;
      time: string;
      weight_class: string;
      event_name: string;
      event_date: string;
      organization_abbreviation: string;
      f1_id: number | null;
      f1_name: string | null;
      f1_image_url: string | null;
      f1_weight_class: string | null;
      f1_organization_id: number | null;
      f1_record: string | null;
      f1_ranking: number | null;
      f2_id: number | null;
      f2_name: string | null;
      f2_image_url: string | null;
      f2_weight_class: string | null;
      f2_organization_id: number | null;
      f2_record: string | null;
      f2_ranking: number | null;
    }>`
      SELECT
        f.id, f.event_id, f.fighter1_id, f.fighter2_id, f.fight_finished, f.winner_id, f.method, f.round, f.time, f.weight_class,
        e.name AS event_name, e.date AS event_date,
        o.abbreviation AS organization_abbreviation,
        f1.id AS f1_id, f1.name AS f1_name, f1.image_url AS f1_image_url, f1.weight_class AS f1_weight_class, f1.organization_id AS f1_organization_id, f1.record AS f1_record, f1.ranking AS f1_ranking,
        f2.id AS f2_id, f2.name AS f2_name, f2.image_url AS f2_image_url, f2.weight_class AS f2_weight_class, f2.organization_id AS f2_organization_id, f2.record AS f2_record, f2.ranking AS f2_ranking
      FROM fights f
      JOIN events e ON f.event_id = e.id
      JOIN organizations o ON e.organization_id = o.id
      LEFT JOIN fighters f1 ON f.fighter1_id = f1.id
      LEFT JOIN fighters f2 ON f.fighter2_id = f2.id
      WHERE f.fight_finished = true
      ORDER BY e.date DESC
      LIMIT ${limit}
    `;

    return data.rows.map((row) => ({
      id: row.id,
      event_id: row.event_id,
      fighter1_id: row.fighter1_id,
      fighter2_id: row.fighter2_id,
      fight_finished: row.fight_finished,
      winner_id: row.winner_id,
      method: row.method,
      round: row.round,
      time: row.time,
      weight_class: row.weight_class,
      event_name: row.event_name,
      event_date: row.event_date,
      organization_abbreviation: row.organization_abbreviation,
      fighter1: row.f1_id
        ? {
            id: row.f1_id,
            name: row.f1_name,
            image_url: row.f1_image_url,
            weight_class: row.f1_weight_class,
            organization_id: row.f1_organization_id,
            record: row.f1_record,
            ranking: row.f1_ranking,
          }
        : null,
      fighter2: row.f2_id
        ? {
            id: row.f2_id,
            name: row.f2_name,
            image_url: row.f2_image_url,
            weight_class: row.f2_weight_class,
            organization_id: row.f2_organization_id,
            record: row.f2_record,
            ranking: row.f2_ranking,
          }
        : null,
    })) as FightResultWithContext[];
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch recent finished fights.');
  }
}
