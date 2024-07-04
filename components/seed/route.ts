import { db, sql } from '@vercel/postgres';
import { organizations, events, fights, fighters } from '../lib/placeholder-data';

async function seedOrganizations() {
  await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;

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
  await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;

  await sql`
    CREATE TABLE IF NOT EXISTS events (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      date DATE NOT NULL,
      organization_id INT REFERENCES organizations(id)
    );
  `;

  const insertedEvents = await Promise.all(
    events.map(
      (event) => sql`
        INSERT INTO events (name, date, organization_id)
        VALUES (${event.name}, ${event.date}, ${event.organization_id})
        ON CONFLICT (id) DO NOTHING;
      `
    ),
  );

  return insertedEvents;
}

async function seedFights() {
  await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;

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
    fights.map(
      (fight) => sql`
        INSERT INTO fights (event_id, fighter1_id, fighter2_id, fight_finished, winner_id, method, round, time, weight_class)
        VALUES (${fight.eventID}, ${fight.fighter1Id}, ${fight.fighter2Id}, ${fight.fightFinished}, ${fight.winnerID}, ${fight.method}, ${fight.round}, ${fight.time}, ${fight.weightClass})
        ON CONFLICT (id) DO NOTHING;
      `
    ),
  );

  return insertedFights;
}

async function seedFighters() {
  await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;

  await sql`
    CREATE TABLE IF NOT EXISTS fighters (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      nationality VARCHAR(255) NOT NULL,
      image_url VARCHAR(255),
      weight_class VARCHAR(50) NOT NULL,
      organization_id INT REFERENCES organizations(id),
      wins INT,
      losses INT,
      draws INT
    );
  `;

  const insertedFighters = await Promise.all(
    fighters.map(
      (fighter) => sql`
        INSERT INTO fighters (name, nationality, image_url, weight_class, organization_id, wins, losses, draws)
        VALUES (${fighter.name}, ${fighter.nationality}, ${fighter.imageUrl}, ${fighter.weightClass}, ${fighter.organization_id}, ${fighter.wins}, ${fighter.losses}, ${fighter.draws})
        ON CONFLICT (id) DO NOTHING;
      `
    ),
  );

  return insertedFighters;
}

export async function GET() {
  try {
    await sql`BEGIN`;
    await seedOrganizations();
    await seedEvents();
    await seedFighters();
    await seedFights();
    await sql`COMMIT`;

    return Response.json({ message: 'Database seeded successfully' });
  } catch (error) {
    await sql`ROLLBACK`;
    return Response.json({ error }, { status: 500 });
  }
}
