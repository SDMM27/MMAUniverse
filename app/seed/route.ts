import { db, sql } from '@vercel/postgres';
import { organizations, events, fights, fighters } from '../../components/lib/placeholder-data';

async function seedOrganizations() {

  await sql`
    CREATE TABLE IF NOT EXISTS organizations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      abbreviation VARCHAR(10) NOT NULL,
      logo_link VARCHAR(255) NOT NULL
    );
  `;

  const insertedOrganizations = await Promise.all(
    organizations.map(
      (org) => sql`
        INSERT INTO organizations (name, abbreviation, logo_link)
        VALUES (${org.name}, ${org.abbreviation}, ${org.logo_link})
        ON CONFLICT (id) DO NOTHING;
      `
    ),
  );

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

  const insertedEvents = await Promise.all(
    events.map(
      (event) => sql`
        INSERT INTO events (name, date, event_location, event_poster, organization_id)
        VALUES (${event.name}, ${event.date}, ${event.event_location}, ${event.event_poster}, ${event.organization_id})
        ON CONFLICT (id) DO NOTHING;
      `
    ),
  );

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

  const insertedFights = await Promise.all(
    fights.map(async (fight) => {
      const eventId = await getEventIdByName(fight.eventName);
      const fighter1Id = await getFighterIdByName(fight.fighter1Name);
      const fighter2Id = await getFighterIdByName(fight.fighter2Name);

      return sql`
        INSERT INTO fights (event_id, fighter1_id, fighter2_id, fight_finished, method, time, weight_class)
        VALUES (${eventId}, ${fighter1Id}, ${fighter2Id}, ${fight.fight_finished}, ${fight.method}, ${fight.time}, ${fight.weight_class})
        ON CONFLICT (id) DO NOTHING;
      `;
    })
  );

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

  const insertedFighters = await Promise.all(
    fighters.map(
      (fighter) => sql`
        INSERT INTO fighters (name, image_url, weight_class, organization_id, record, ranking)
        VALUES (${fighter.name}, ${fighter.image_url}, ${fighter.weight_class}, ${fighter.organization_id}, ${fighter.record}, ${fighter.ranking})
        ON CONFLICT (id) DO NOTHING;
      `
    ),
  );

  return insertedFighters;
}

export async function GET() {
  try {
    await sql`BEGIN`;

    // await seedOrganizations();  // Cette fonction doit être exécutée en premier
    // await seedEvents();         // Dépend de `organizations`
    // await seedFighters();       // Peut dépendre de `organizations`
    await seedFights();         // Dépend de `events` et `fighters`

    await sql`COMMIT`;

    return Response.json({ message: 'Database seeded successfully' });
  } catch (error) {
    console.error(error);  // Pour un meilleur débogage
    await sql`ROLLBACK`;
    return Response.json({ error }, { status: 500 });
  }
}
