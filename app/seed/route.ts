import { sql } from '@/data/lib/db';
import { organizations } from '@/data/lib/placeholder-data';
import type { ScrapedOrgData } from '@/data/scrapers/shared/types';
import ufcData from '@/data/scraped/ufc.json';
import pflData from '@/data/scraped/pfl.json';
import bellatorData from '@/data/scraped/bellator.json';

const orgDatasets = [ufcData, pflData, bellatorData] as ScrapedOrgData[];

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
  // Letting SERIAL auto-assign ids via a concurrent Promise.all would race — whichever
  // insert reaches Postgres first gets id 1, not necessarily UFC — silently breaking
  // every downstream fighters/events organization_id foreign key.
  const insertedOrganizations = await Promise.all(
    organizations.map(
      (org) => sql`
        INSERT INTO organizations (id, name, abbreviation, logo_link)
        VALUES (${org.id}, ${org.name}, ${org.abbreviation}, ${org.logo_link})
        ON CONFLICT (id) DO NOTHING;
      `
    ),
  );

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

  const insertedEvents = [];
  for (const dataset of orgDatasets) {
    for (const event of dataset.events) {
      const result = await sql`
        INSERT INTO events (name, date, event_location, event_poster, organization_id)
        VALUES (${event.name}, ${event.date}, ${event.event_location}, ${event.event_poster}, ${dataset.organization_id})
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

export async function GET() {
  try {
    await sql`BEGIN`;

    await seedOrganizations(); // Cette fonction doit être exécutée en premier
    await seedEvents();        // Dépend de `organizations`
    await seedFighters();      // Peut dépendre de `organizations`
    await seedFights();        // Dépend de `events` et `fighters`

    await sql`COMMIT`;

    return Response.json({ message: 'Database seeded successfully' });
  } catch (error) {
    console.error(error);  // Pour un meilleur débogage
    await sql`ROLLBACK`;
    return Response.json({ error }, { status: 500 });
  }
}
