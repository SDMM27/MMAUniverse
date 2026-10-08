// data/scrapers/seed-additional-orgs.ts
//
// Seeds one or more `data/scraped/<key>.json` datasets into the DB for
// organizations that are NOT among the original 3 (UFC=1/PFL=2/Bellator=3).
//
// Deliberately separate from `data/scripts/seed-db.ts`: that script's
// seedEvents/seedFighters/seedFights loop unconditionally INSERTs every row
// in its dataset list with no natural-key uniqueness check (only `id`, which
// is never supplied, so `ON CONFLICT (id) DO NOTHING` never fires). Re-running
// it would duplicate the already-seeded UFC/PFL/Bellator data. This script
// only ever touches the new organization_ids passed on the command line, and
// checks for an existing row (by name + organization_id, the natural key the
// rest of the app already relies on — see `resolveFighterIds` in
// data/lib/data.ts) before inserting, so it's safe to re-run if a scrape is
// resumed or partially redone.
//
// Usage: npx tsx data/scrapers/seed-additional-orgs.ts <key1> [key2 ...]
// e.g.:  npx tsx data/scrapers/seed-additional-orgs.ts invicta rizin lfa

import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve('.env.local') });

import { sql } from '../lib/db';
import { organizations } from '../lib/placeholder-data';
import { ORG_CONFIGS } from './orgs.config';
import type { ScrapedOrgData } from './shared/types';

const SCRAPED_DIR = path.resolve('data/scraped');

async function seedOrganizations() {
  // Genuinely idempotent: `id` is explicit, so ON CONFLICT (id) DO NOTHING
  // really does skip rows that already exist (unlike events/fighters below).
  for (const org of organizations) {
    await sql`
      INSERT INTO organizations (id, name, abbreviation, logo_link)
      VALUES (${org.id}, ${org.name}, ${org.abbreviation}, ${org.logo_link})
      ON CONFLICT (id) DO NOTHING;
    `;
  }
  await sql`SELECT setval('organizations_id_seq', (SELECT MAX(id) FROM organizations));`;
}

async function findEventId(name: string, organizationId: number): Promise<number | null> {
  const res = await sql<{ id: number }>`
    SELECT id FROM events WHERE name = ${name} AND organization_id = ${organizationId};
  `;
  return res.rows[0]?.id ?? null;
}

async function findFighterId(name: string, organizationId: number): Promise<number | null> {
  const res = await sql<{ id: number }>`
    SELECT id FROM fighters WHERE name = ${name} AND organization_id = ${organizationId};
  `;
  return res.rows[0]?.id ?? null;
}

async function seedDataset(data: ScrapedOrgData) {
  const orgId = data.organization_id;

  let insertedEvents = 0;
  for (const event of data.events) {
    const existing = await findEventId(event.name, orgId);
    if (existing) continue;
    await sql`
      INSERT INTO events (name, date, event_location, event_poster, organization_id)
      VALUES (${event.name}, ${event.date}, ${event.event_location}, ${event.event_poster}, ${orgId});
    `;
    insertedEvents++;
  }

  let insertedFighters = 0;
  for (const fighter of data.fighters) {
    const existing = await findFighterId(fighter.name, orgId);
    if (existing) continue;
    await sql`
      INSERT INTO fighters (name, image_url, weight_class, organization_id, record, ranking)
      VALUES (${fighter.name}, ${fighter.image_url}, ${fighter.weight_class}, ${orgId}, ${fighter.record}, ${fighter.ranking});
    `;
    insertedFighters++;
  }

  let insertedFights = 0;
  for (const fight of data.fights) {
    const eventId = await findEventId(fight.event_name, orgId);
    const fighter1Id = await findFighterId(fight.fighter1_name, orgId);
    const fighter2Id = await findFighterId(fight.fighter2_name, orgId);
    const winnerId = fight.winner_name ? await findFighterId(fight.winner_name, orgId) : null;

    if (!eventId || !fighter1Id || !fighter2Id) {
      console.warn(
        `  [skip] missing ref for fight "${fight.fighter1_name}" vs "${fight.fighter2_name}" @ "${fight.event_name}" (eventId=${eventId}, f1=${fighter1Id}, f2=${fighter2Id})`,
      );
      continue;
    }

    // Guard against re-running this script over an already-seeded event.
    const already = await sql<{ id: number }>`
      SELECT id FROM fights WHERE event_id = ${eventId} AND fighter1_id = ${fighter1Id} AND fighter2_id = ${fighter2Id};
    `;
    if (already.rows[0]) continue;

    await sql`
      INSERT INTO fights (event_id, fighter1_id, fighter2_id, fight_finished, winner_id, method, round, time, weight_class, is_main_event)
      VALUES (${eventId}, ${fighter1Id}, ${fighter2Id}, ${fight.fight_finished}, ${winnerId}, ${fight.method}, ${fight.round}, ${fight.time}, ${fight.weight_class}, ${fight.is_main_event ?? false});
    `;
    insertedFights++;
  }

  return { insertedEvents, insertedFighters, insertedFights };
}

async function main() {
  const keys = process.argv.slice(2);
  if (keys.length === 0) {
    console.error('Usage: npx tsx data/scrapers/seed-additional-orgs.ts <key1> [key2 ...]');
    process.exit(1);
  }

  // Refuse to touch the original 3 through this script — they go through
  // data/scripts/seed-db.ts only.
  const forbidden = keys.filter((k) => ['ufc', 'pfl', 'bellator'].includes(k));
  if (forbidden.length > 0) {
    console.error(`Refusing to seed ${forbidden.join(', ')} via this script — use data/scripts/seed-db.ts.`);
    process.exit(1);
  }

  await seedOrganizations();

  for (const key of keys) {
    const config = ORG_CONFIGS.find((c) => c.orgKey === key);
    if (!config) {
      console.error(`Unknown org key "${key}". Expected one of: ${ORG_CONFIGS.map((c) => c.orgKey).join(', ')}`);
      continue;
    }
    const file = path.join(SCRAPED_DIR, `${key}.json`);
    if (!fs.existsSync(file)) {
      console.error(`[${key}] no scraped data at ${file}, skipping.`);
      continue;
    }
    const data = JSON.parse(fs.readFileSync(file, 'utf8')) as ScrapedOrgData;
    console.log(`[${key}] seeding ${data.events.length} events, ${data.fighters.length} fighters, ${data.fights.length} fights...`);
    const result = await seedDataset(data);
    console.log(
      `[${key}] done: +${result.insertedEvents} events, +${result.insertedFighters} fighters, +${result.insertedFights} fights (skipped = already present).`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
