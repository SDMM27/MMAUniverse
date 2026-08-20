// data/scrapers/sync-upcoming-to-db.ts
//
// Targeted DB sync: upserts only the not-yet-happened events (date >= today) from
// data/scraped/{ufc,pfl,bellator}.json into Neon, by name/date rather than blind INSERT.
// Unlike app/seed/route.ts (which has no UNIQUE constraint to lean on and would duplicate
// every row on a second run), this is safe to re-run: existing events/fighters are matched
// by name and UPDATEd in place, and each event's fight list is fully replaced (delete-then-
// insert) rather than appended to.
import fs from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';
import type { ScrapedOrgData } from './shared/types';

// tsx doesn't auto-load .env.local the way Next.js does; parse it by hand.
function loadEnvLocal() {
  const envPath = path.resolve('.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvLocal();

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set (expected in .env.local)');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

function loadDataset(orgKey: string): ScrapedOrgData {
  return JSON.parse(fs.readFileSync(path.resolve('data/scraped', `${orgKey}.json`), 'utf-8'));
}

const datasets = [loadDataset('ufc'), loadDataset('pfl'), loadDataset('bellator')];

async function upsertEvent(event: { name: string; date: string; event_location: string; event_poster: string }, organizationId: number) {
  const existing = await sql`SELECT id FROM events WHERE name = ${event.name}`;
  if (existing.length > 0) {
    const id = existing[0].id;
    await sql`
      UPDATE events SET date = ${event.date}, event_location = ${event.event_location},
        event_poster = ${event.event_poster}, organization_id = ${organizationId}
      WHERE id = ${id}
    `;
    return id;
  }
  const inserted = await sql`
    INSERT INTO events (name, date, event_location, event_poster, organization_id)
    VALUES (${event.name}, ${event.date}, ${event.event_location}, ${event.event_poster}, ${organizationId})
    RETURNING id
  `;
  return inserted[0].id;
}

async function upsertFighter(
  fighter: { name: string; image_url: string; weight_class: string; record: string; ranking: number },
  organizationId: number,
) {
  const existing = await sql`SELECT id FROM fighters WHERE name = ${fighter.name}`;
  if (existing.length > 0) {
    const id = existing[0].id;
    await sql`
      UPDATE fighters SET image_url = ${fighter.image_url}, weight_class = ${fighter.weight_class},
        record = ${fighter.record}, ranking = ${fighter.ranking}
      WHERE id = ${id}
    `;
    return id;
  }
  const inserted = await sql`
    INSERT INTO fighters (name, image_url, weight_class, organization_id, record, ranking)
    VALUES (${fighter.name}, ${fighter.image_url}, ${fighter.weight_class}, ${organizationId}, ${fighter.record}, ${fighter.ranking})
    RETURNING id
  `;
  return inserted[0].id;
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  console.log(`Syncing events with date >= ${today}...`);

  for (const dataset of datasets) {
    const futureEvents = dataset.events.filter((e) => e.date >= today);
    if (futureEvents.length === 0) continue;

    // Sherdog sometimes renames an event once its full card firms up (e.g. "UFC Fight Night -
    // Sept. 26" -> "... Barcelos vs. Rosas Jr."). A prior /seed run may have stored the event
    // under the old name; matching by name alone would leave that stale row behind as a
    // duplicate. Find and remove any future-dated DB row for this org whose name isn't in our
    // freshly-scraped set before upserting.
    const freshNames = new Set(futureEvents.map((e) => e.name));
    const staleRows = await sql`
      SELECT id, name FROM events
      WHERE organization_id = ${dataset.organization_id} AND date >= ${today}
    `;
    for (const row of staleRows as any[]) {
      if (freshNames.has(row.name)) continue;
      console.log(`  removing stale event "${row.name}" (renamed upstream)`);
      await sql`DELETE FROM fights WHERE event_id = ${row.id}`;
      await sql`DELETE FROM events WHERE id = ${row.id}`;
    }

    for (const event of futureEvents) {
      const eventId = await upsertEvent(event, dataset.organization_id);
      const eventFights = dataset.fights.filter((f) => f.event_name === event.name);

      // Full replace: this event's card in the JSON is now authoritative.
      await sql`DELETE FROM fights WHERE event_id = ${eventId}`;

      for (const fight of eventFights) {
        const fighter1 = dataset.fighters.find((f) => f.name === fight.fighter1_name);
        const fighter2 = dataset.fighters.find((f) => f.name === fight.fighter2_name);
        if (!fighter1 || !fighter2) {
          console.warn(`  skipping fight "${fight.fighter1_name} vs ${fight.fighter2_name}" — fighter data missing`);
          continue;
        }
        const fighter1Id = await upsertFighter(fighter1, dataset.organization_id);
        const fighter2Id = await upsertFighter(fighter2, dataset.organization_id);
        const winnerId = fight.winner_name
          ? await upsertFighter(
              dataset.fighters.find((f) => f.name === fight.winner_name) ?? { name: fight.winner_name, image_url: '', weight_class: '', record: '', ranking: 0 },
              dataset.organization_id,
            )
          : null;

        await sql`
          INSERT INTO fights (event_id, fighter1_id, fighter2_id, fight_finished, winner_id, method, round, time, weight_class)
          VALUES (${eventId}, ${fighter1Id}, ${fighter2Id}, ${fight.fight_finished}, ${winnerId}, ${fight.method}, ${fight.round}, ${fight.time}, ${fight.weight_class})
        `;
      }

      console.log(`  synced "${event.name}" -> ${eventFights.length} fight(s)`);
    }
  }

  console.log('Done.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
