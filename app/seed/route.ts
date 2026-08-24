import { sql } from '@/data/lib/db';
import { organizations } from '@/data/lib/placeholder-data';
import type { ScrapedOrgData } from '@/data/scrapers/shared/types';
import ufcData from '@/data/scraped/ufc.json';
import pflData from '@/data/scraped/pfl.json';
import bellatorData from '@/data/scraped/bellator.json';

const orgDatasets = [ufcData, pflData, bellatorData] as ScrapedOrgData[];

// Route Handlers cache underlying fetch() calls by default in Next.js 14's App
// Router. @neondatabase/serverless issues its queries as POST fetch() calls
// under the hood, so without this they get swept into Next's Data Cache like
// any other fetch — a query replayed from cache silently returns stale data
// instead of hitting the database again.
export const dynamic = 'force-dynamic';

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

  const insertedEvents = [];
  for (const dataset of orgDatasets) {
    for (const event of dataset.events) {
      const result = await sql`
        INSERT INTO events (name, date, start_time, event_location, event_poster, organization_id)
        VALUES (${event.name}, ${event.date}, ${event.start_time ?? null}, ${event.event_location}, ${event.event_poster}, ${dataset.organization_id})
        ON CONFLICT (id) DO NOTHING;
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
  const res = await sql`
    SELECT id FROM fighters WHERE name = ${fighterName};
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

  const insertedFights = [];
  for (const dataset of orgDatasets) {
    for (const fight of dataset.fights) {
      const eventId = await getEventIdByName(fight.event_name);
      const fighter1Id = await getFighterIdByName(fight.fighter1_name);
      const fighter2Id = await getFighterIdByName(fight.fighter2_name);
      const winnerId = fight.winner_name ? await getFighterIdByName(fight.winner_name) : null;

      await sql`
        DELETE FROM fights WHERE event_id = ${eventId} AND fighter1_id = ${fighter1Id} AND fighter2_id = ${fighter2Id};
      `;

      const result = await sql`
        INSERT INTO fights (event_id, fighter1_id, fighter2_id, fight_finished, winner_id, method, round, time, weight_class)
        VALUES (${eventId}, ${fighter1Id}, ${fighter2Id}, ${fight.fight_finished}, ${winnerId}, ${fight.method}, ${fight.round}, ${fight.time}, ${fight.weight_class})
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

  const insertedFighters = [];
  for (const dataset of orgDatasets) {
    for (const fighter of dataset.fighters) {
      const result = await sql`
        INSERT INTO fighters (name, image_url, weight_class, organization_id, record, ranking)
        VALUES (${fighter.name}, ${fighter.image_url}, ${fighter.weight_class}, ${dataset.organization_id}, ${fighter.record}, ${fighter.ranking})
        ON CONFLICT (id) DO NOTHING;
      `;
      insertedFighters.push(result);
    }
  }

  return insertedFighters;
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

export async function GET() {
  try {
    await seedOrganizations(); // Cette fonction doit être exécutée en premier
    await seedEvents();        // Dépend de `organizations`
    await seedFighters();      // Peut dépendre de `organizations`
    await seedFights();        // Dépend de `events` et `fighters`
    await seedPickemSchema();  // Dépend de `fighters` (predicted_winner_id FK)

    return Response.json({ message: 'Database seeded successfully' });
  } catch (error) {
    console.error(error);  // Pour un meilleur débogage
    return Response.json({ error }, { status: 500 });
  }
}
