// data/scripts/seed-db.ts
//
// Creates the core schema (organizations, events, fights, fighters, rankings,
// pick'em and profile-preference tables) and seeds it from the UFC/PFL/
// Bellator/ONE datasets in data/scraped/. Formerly the public `/seed` route
// handler, which anyone could call in production and which bundled ~65 MB of
// JSON into a serverless function; now a local CLI only.
//
// Usage: npm run seed:db   (reads DATABASE_URL from .env.local)

import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve('.env.local') });

import { sql } from '../lib/db';
import { organizations } from '../lib/placeholder-data';
import type { ScrapedOrgData } from '../scrapers/shared/types';

const SCRAPED_DIR = path.resolve('data/scraped');

const orgDatasets = ['ufc', 'pfl', 'bellator', 'one'].map(
  (key) => JSON.parse(fs.readFileSync(path.join(SCRAPED_DIR, `${key}.json`), 'utf-8')) as ScrapedOrgData,
);

async function seedOrganizations() {

  await sql`
    CREATE TABLE IF NOT EXISTS organizations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      abbreviation VARCHAR(10) NOT NULL,
      logo_link VARCHAR(255) NOT NULL
    );
  `;

  // Explicit `id` matters here: data/scraped/*.json and data/scrapers/orgs.config.ts
  // hardcode organization_id (1=UFC, 2=PFL, 3=Bellator) to match `organizations[].id`.
  // Inserted sequentially (not Promise.all): firing these concurrently raced against
  // Neon's HTTP-over-SQL proxy — each insert individually reported success (rowCount 1)
  // but the rows never became visible, even to a read-back in the very same request.
  // Discovered while running Task 13's manual seed verification; sequential avoids it.
  const insertedOrganizations = [];
  for (const org of organizations) {
    const result = await sql`
      INSERT INTO organizations (id, name, abbreviation, logo_link)
      VALUES (${org.id}, ${org.name}, ${org.abbreviation}, ${org.logo_link})
      ON CONFLICT (id) DO NOTHING;
    `;
    insertedOrganizations.push(result);
  }

  // Resync the SERIAL sequence past the explicit ids above, so any future insert
  // that omits `id` (relying on the default) doesn't collide with them.
  await sql`SELECT setval('organizations_id_seq', (SELECT MAX(id) FROM organizations));`;

  return insertedOrganizations;
}

async function seedEvents() {
  await sql`
    CREATE TABLE IF NOT EXISTS events (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      date VARCHAR(255) NOT NULL,
      event_location VARCHAR(255),
      event_poster VARCHAR(255),
      organization_id INT REFERENCES organizations(id)
    );
  `;

  await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ;`;
  // UFC-only for now (see data/scrapers/sync-ufc-broadcast-times.ts) — the real broadcast
  // schedule scraped from ufc.com, distinct from the coarse Sherdog-sourced start_time above
  // (which is a real time only when Sherdog happens to have one; otherwise midnight UTC on
  // `date`, see formatEventTime's placeholder filtering in data/lib/event-utils.ts). Null for
  // every other organization and for any UFC event ufc.com hasn't published a page for yet.
  await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS prelims_start TIMESTAMPTZ;`;
  await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS main_card_start TIMESTAMPTZ;`;

  // `ON CONFLICT (id) DO NOTHING` below never actually fires: `id` is a fresh
  // SERIAL value on every INSERT since it's never supplied, so there's never
  // a conflicting id to skip. Same bug as seedFighters had (see the comment
  // there) — every re-run of /seed silently duplicated the entire events
  // table. Checking for an existing row first (matched by name, the same key
  // getEventIdByName uses to resolve fights to their event) makes this
  // idempotent instead.
  const insertedEvents = [];
  for (const dataset of orgDatasets) {
    for (const event of dataset.events) {
      const existing = await sql`
        SELECT id FROM events WHERE name = ${event.name} ORDER BY id ASC;
      `;
      if (existing.rows[0]) {
        const result = await sql`
          UPDATE events SET date = ${event.date}, start_time = ${event.start_time ?? null}, event_location = ${event.event_location}, event_poster = ${event.event_poster}, organization_id = ${dataset.organization_id}
          WHERE id = ${existing.rows[0].id};
        `;
        insertedEvents.push(result);
        continue;
      }
      const result = await sql`
        INSERT INTO events (name, date, start_time, event_location, event_poster, organization_id)
        VALUES (${event.name}, ${event.date}, ${event.start_time ?? null}, ${event.event_location}, ${event.event_poster}, ${dataset.organization_id});
      `;
      insertedEvents.push(result);
    }
  }

  return insertedEvents;
}

async function getEventIdByName(eventName: string) {
  const res = await sql`
    SELECT id FROM events WHERE name = ${eventName};
  `;
  return res.rows[0] ? res.rows[0].id : null;
}

async function getFighterIdByName(fighterName: string) {
  // ORDER BY id ASC pins this to the original row deterministically. Without
  // it, once a name has duplicates (see seedFighters below) this picks
  // whichever row Postgres happens to return first, which can differ between
  // runs — that in turn broke seedFights' (event_id, fighter1_id,
  // fighter2_id) dedup key and left both the old and a new duplicate fight
  // row behind. See data/scrapers/dedupe-seed-duplicates.ts for the one-time
  // cleanup this required.
  const res = await sql`
    SELECT id FROM fighters WHERE name = ${fighterName} ORDER BY id ASC;
  `;
  return res.rows[0] ? res.rows[0].id : null;
}

async function seedFights() {
  await sql`
    CREATE TABLE IF NOT EXISTS fights (
      id SERIAL PRIMARY KEY,
      event_id INT REFERENCES events(id),
      fighter1_id INT REFERENCES fighters(id),
      fighter2_id INT REFERENCES fighters(id),
      fight_finished BOOLEAN NOT NULL,
      winner_id INT REFERENCES fighters(id),
      method VARCHAR(50),
      round INT,
      time VARCHAR(10),
      weight_class VARCHAR(50)
    );
  `;

  await sql`ALTER TABLE fights ADD COLUMN IF NOT EXISTS is_main_event BOOLEAN NOT NULL DEFAULT false;`;
  await sql`ALTER TABLE fights ADD COLUMN IF NOT EXISTS is_title_fight BOOLEAN NOT NULL DEFAULT false;`;

  const insertedFights = [];
  for (const dataset of orgDatasets) {
    for (const fight of dataset.fights) {
      const eventId = await getEventIdByName(fight.event_name);
      const fighter1Id = await getFighterIdByName(fight.fighter1_name);
      const fighter2Id = await getFighterIdByName(fight.fighter2_name);
      const winnerId = fight.winner_name ? await getFighterIdByName(fight.winner_name) : null;

      // IS NOT DISTINCT FROM, not `=`: when a fighter name doesn't resolve
      // (getFighterIdByName returns null — see data/scrapers/dedupe-seed-
      // duplicates.ts for why that happens), fighter1Id/fighter2Id is NULL,
      // and `column = NULL` is never true in SQL regardless of the row's
      // actual value. With plain `=` this DELETE silently matched nothing
      // for every such fight, so each re-run of /seed left the old
      // null-sided row behind *and* inserted a fresh duplicate — this is how
      // 6 re-runs turned ~30 unresolvable fights into 180 duplicate rows.
      await sql`
        DELETE FROM fights WHERE event_id IS NOT DISTINCT FROM ${eventId} AND fighter1_id IS NOT DISTINCT FROM ${fighter1Id} AND fighter2_id IS NOT DISTINCT FROM ${fighter2Id};
      `;

      const result = await sql`
        INSERT INTO fights (event_id, fighter1_id, fighter2_id, fight_finished, winner_id, method, round, time, weight_class, is_main_event, is_title_fight)
        VALUES (${eventId}, ${fighter1Id}, ${fighter2Id}, ${fight.fight_finished}, ${winnerId}, ${fight.method}, ${fight.round}, ${fight.time}, ${fight.weight_class}, ${fight.is_main_event ?? false}, ${fight.is_title_fight ?? false})
        ON CONFLICT (id) DO NOTHING;
      `;
      insertedFights.push(result);
    }
  }

  return insertedFights;
}

async function seedFighters() {
  await sql`
    CREATE TABLE IF NOT EXISTS fighters (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      image_url VARCHAR(255),
      weight_class VARCHAR(50),
      organization_id INT REFERENCES organizations(id),
      record VARCHAR(50),
      ranking INT
    );
  `;

  await sql`ALTER TABLE fighters ADD COLUMN IF NOT EXISTS nationality VARCHAR(2);`;

  // `ON CONFLICT (id) DO NOTHING` below never actually fires: `id` is a fresh
  // SERIAL value on every INSERT since it's never supplied, so there's never
  // a conflicting id to skip. With no UNIQUE constraint on (name,
  // organization_id) either, every re-run of /seed silently duplicated the
  // entire fighter roster. Checking for an existing row first (same pattern
  // as upsertFighter in data/scrapers/sync-upcoming-to-db.ts) makes this
  // idempotent instead.
  const insertedFighters = [];
  for (const dataset of orgDatasets) {
    for (const fighter of dataset.fighters) {
      const existing = await sql`
        SELECT id FROM fighters WHERE name = ${fighter.name} AND organization_id = ${dataset.organization_id} ORDER BY id ASC;
      `;
      if (existing.rows[0]) {
        const result = await sql`
          UPDATE fighters SET image_url = ${fighter.image_url}, weight_class = ${fighter.weight_class}, record = ${fighter.record}, ranking = ${fighter.ranking}
          WHERE id = ${existing.rows[0].id};
        `;
        insertedFighters.push(result);
        continue;
      }
      const result = await sql`
        INSERT INTO fighters (name, image_url, weight_class, organization_id, record, ranking)
        VALUES (${fighter.name}, ${fighter.image_url}, ${fighter.weight_class}, ${dataset.organization_id}, ${fighter.record}, ${fighter.ranking});
      `;
      insertedFighters.push(result);
    }
  }

  return insertedFighters;
}

async function seedRankings() {
  await sql`
    CREATE TABLE IF NOT EXISTS rankings (
      id SERIAL PRIMARY KEY,
      organization_id INT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      -- Verbatim division label as published by the org's own source (UFC.com
      -- for now), e.g. "Flyweight", "Women's Strawweight", "Men's Pound-for-
      -- Pound Top Rank". Deliberately NOT matched or foreign-keyed against
      -- fighters.weight_class -- that column is freeform Sherdog text (see
      -- data/scrapers/parse.ts) that doesn't even distinguish women's
      -- divisions. Grouping/display for this feature always uses this
      -- column, never fighters.weight_class.
      weight_class VARCHAR(100) NOT NULL,
      -- 0 = champion (UFC.com shows the champion in the table's caption, not
      -- as a numbered row -- the scraper normalizes that to rank 0).
      -- 1-15 = numbered contenders.
      rank SMALLINT NOT NULL,
      -- Always populated even when fighter_id can't be resolved, so the UI
      -- can still render the name as plain text.
      fighter_name VARCHAR(255) NOT NULL,
      -- SET NULL, not CASCADE: losing the name-match shouldn't delete the
      -- ranking row itself, just fall back to displaying fighter_name.
      fighter_id INT REFERENCES fighters(id) ON DELETE SET NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      -- fighter_name is part of the key, not just (organization_id,
      -- weight_class, rank): ufc.com's own rankings genuinely tie two
      -- fighters at the same rank sometimes (confirmed live 2026-09-15,
      -- e.g. Men's P4P had Joshua Van and Ciryl Gane both at rank 10, with
      -- 11 skipped) -- a rank-only unique constraint rejects that as a
      -- duplicate-key error and crashes the sync. See sync-ufc-rankings.ts's
      -- own migration for how an already-existing table with the old
      -- (broken) constraint gets fixed.
      UNIQUE (organization_id, weight_class, rank, fighter_name)
    );
  `;
}

async function seedPickemSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      external_auth_id TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS picks (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id),
      -- fight_id/predicted_winner_id are INT (not BIGINT) to match fights.id/
      -- fighters.id, both SERIAL (int4). Mismatched int4/int8 FKs are legal in
      -- Postgres but the driver (@neondatabase/serverless, no type parser
      -- override -- see data/lib/db.ts) returns int8 columns as JS strings and
      -- int4 as numbers; a BIGINT here would make every strict equality
      -- comparison against a fights/fighters id (scorePick's winner check,
      -- Map lookups keyed by fight_id) silently fail. Confirmed empirically
      -- against the real driver while reviewing this task.
      fight_id INT NOT NULL REFERENCES fights(id) ON DELETE CASCADE,
      predicted_winner_id INT NOT NULL REFERENCES fighters(id),
      predicted_method_category TEXT NOT NULL CHECK (predicted_method_category IN ('ko_tko', 'submission', 'decision')),
      predicted_round SMALLINT CHECK (predicted_round IS NULL OR predicted_round BETWEEN 1 AND 5),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (user_id, fight_id)
    );
  `;
}

async function seedProfilePreferencesSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS user_fighter_preferences (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id),
      -- INT, not BIGINT: matches fighters.id (SERIAL/int4). Same reasoning as
      -- picks.predicted_winner_id (see seedPickemSchema above) -- a BIGINT
      -- column here would make @neondatabase/serverless return this as a JS
      -- string while fighters.id comes back as a number, breaking strict
      -- equality comparisons against it.
      fighter_id INT NOT NULL REFERENCES fighters(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (user_id, fighter_id)
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS user_nationality_preferences (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id),
      -- No FK: fighters.nationality is itself a free VARCHAR(2), including
      -- non-ISO UK codes ("en"/"wa"/"nb", see components/ui/shared/country-
      -- flag.tsx) -- there's no lookup table to reference. Validated instead
      -- at the API layer against fetchAvailableNationalities() (Task 4).
      nationality_code TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (user_id, nationality_code)
    );
  `;
}

async function main() {
  await seedOrganizations(); // Cette fonction doit être exécutée en premier
  await seedEvents();        // Dépend de `organizations`
  await seedFighters();      // Peut dépendre de `organizations`
  await seedFights();        // Dépend de `events` et `fighters`
  await seedRankings();      // Dépend de `organizations` et `fighters` (fighter_id FK)
  await seedPickemSchema();  // Dépend de `fighters` (predicted_winner_id FK)
  await seedProfilePreferencesSchema(); // Dépend de `users` et `fighters`
  console.log('Database seeded successfully');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
