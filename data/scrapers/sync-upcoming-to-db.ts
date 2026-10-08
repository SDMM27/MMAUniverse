// data/scrapers/sync-upcoming-to-db.ts
//
// Targeted DB sync: upserts only the not-yet-happened events (date >= today) from each org's
// data/scraped/{orgKey}.json into Neon, by name/date rather than blind INSERT -- plus the
// results of recently-past events still unfinished in the DB (see syncRecentPastResults).
// Unlike app/seed/route.ts (which has no UNIQUE constraint to lean on and would duplicate
// every row on a second run), this is safe to re-run: existing events/fighters are matched
// by name and UPDATEd in place, and each event's fights are reconciled by fighter pair
// (see shared/fight-sync.ts) so unchanged fights keep their `id` across syncs.
import fs from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';
import type { ScrapedFighter, ScrapedOrgData } from './shared/types';
import { currentRecord } from './shared/fighter-record';
import { planFightSync, type FreshFight } from './shared/fight-sync';
import { ORG_CONFIGS } from './orgs.config';
import { isRecentPastDate } from './shared/live-dates';

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
    let value = trimmed.slice(eq + 1).trim();
    // `vercel env pull` wraps every value in double quotes; strip a single
    // matching pair so DATABASE_URL etc. don't end up with literal quote
    // characters baked into them.
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
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

// Every configured org, not just ufc/pfl/bellator — rescrape-upcoming.ts (and run-all.ts)
// write a data/scraped/{orgKey}.json for each entry in ORG_CONFIGS, so sync should pick up
// all of them rather than silently ignoring one, cagewarriors, rizin, ksw, aca, invicta, lfa.
const datasets = ORG_CONFIGS.map((config) => loadDataset(config.orgKey));

async function upsertEvent(
  event: { name: string; date: string; start_time?: string; event_location: string; event_poster: string },
  organizationId: number,
) {
  // start_time is absent on any org's JSON that hasn't been rescraped since
  // that field was introduced — fall back to null rather than writing
  // `undefined` (which would rely on JSON.stringify's implicit undefined->
  // omitted-array-element behavior in the underlying HTTP driver call).
  const startTime = event.start_time ?? null;
  const existing = await sql`SELECT id FROM events WHERE name = ${event.name}`;
  if (existing.length > 0) {
    const id = existing[0].id;
    await sql`
      UPDATE events SET date = ${event.date}, start_time = ${startTime}, event_location = ${event.event_location},
        event_poster = ${event.event_poster}, organization_id = ${organizationId}
      WHERE id = ${id}
    `;
    return id;
  }
  const inserted = await sql`
    INSERT INTO events (name, date, start_time, event_location, event_poster, organization_id)
    VALUES (${event.name}, ${event.date}, ${startTime}, ${event.event_location}, ${event.event_poster}, ${organizationId})
    RETURNING id
  `;
  return inserted[0].id;
}

async function upsertFighter(
  fighter: { name: string; image_url: string; weight_class: string; record: string; ranking: number; fight_history?: ScrapedFighter['fight_history'] },
  organizationId: number,
) {
  const record = currentRecord(fighter);
  const existing = await sql`SELECT id FROM fighters WHERE name = ${fighter.name} ORDER BY id ASC`;
  if (existing.length > 0) {
    const id = existing[0].id;
    await sql`
      UPDATE fighters SET image_url = ${fighter.image_url}, weight_class = ${fighter.weight_class},
        record = ${record}, ranking = ${fighter.ranking}
      WHERE id = ${id}
    `;
    return id;
  }
  const inserted = await sql`
    INSERT INTO fighters (name, image_url, weight_class, organization_id, record, ranking)
    VALUES (${fighter.name}, ${fighter.image_url}, ${fighter.weight_class}, ${organizationId}, ${record}, ${fighter.ranking})
    RETURNING id
  `;
  return inserted[0].id;
}

type ScrapedEventRow = ScrapedOrgData['events'][number];

// Upserts the event and reconciles its fights (by fighter pair) against what the DB has.
async function syncEvent(dataset: ScrapedOrgData, event: ScrapedEventRow) {
  const eventId = await upsertEvent(event, dataset.organization_id);
  const eventFights = dataset.fights.filter((f) => f.event_name === event.name);

  const freshFights: FreshFight[] = [];
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

    freshFights.push({
      fighter1_id: fighter1Id,
      fighter2_id: fighter2Id,
      fight_finished: fight.fight_finished,
      winner_id: winnerId,
      method: fight.method,
      round: fight.round,
      time: fight.time,
      weight_class: fight.weight_class,
      is_main_event: fight.is_main_event ?? false,
      is_title_fight: fight.is_title_fight ?? false,
    });
  }

  const existingRows = (await sql`
    SELECT id, fighter1_id, fighter2_id FROM fights WHERE event_id = ${eventId}
  `) as { id: number; fighter1_id: number; fighter2_id: number }[];
  const plan = planFightSync(existingRows, freshFights);

  for (const { id, fight } of plan.toUpdate) {
    await sql`
      UPDATE fights SET fighter1_id = ${fight.fighter1_id}, fighter2_id = ${fight.fighter2_id},
        fight_finished = ${fight.fight_finished}, winner_id = ${fight.winner_id},
        method = ${fight.method}, round = ${fight.round}, time = ${fight.time}, weight_class = ${fight.weight_class},
        is_main_event = ${fight.is_main_event}, is_title_fight = ${fight.is_title_fight}
      WHERE id = ${id}
    `;
  }
  for (const fight of plan.toInsert) {
    await sql`
      INSERT INTO fights (event_id, fighter1_id, fighter2_id, fight_finished, winner_id, method, round, time, weight_class, is_main_event, is_title_fight)
      VALUES (${eventId}, ${fight.fighter1_id}, ${fight.fighter2_id}, ${fight.fight_finished}, ${fight.winner_id}, ${fight.method}, ${fight.round}, ${fight.time}, ${fight.weight_class}, ${fight.is_main_event}, ${fight.is_title_fight})
    `;
  }
  // A fight genuinely pulled from the card (not just unchanged) is deleted here.
  // picks.fight_id is ON DELETE CASCADE (a later task) so any picks on it are removed
  // along with it — consistent with the spec's "traité comme si ce combat n'avait
  // jamais existé" rule for withdrawn fights.
  for (const id of plan.toDeleteIds) {
    await sql`DELETE FROM fights WHERE id = ${id}`;
  }

  console.log(
    `  synced "${event.name}" -> ${plan.toUpdate.length} updated, ${plan.toInsert.length} new, ${plan.toDeleteIds.length} removed`,
  );
}

// Recently-past events whose DB row still has a fight not marked finished. The "date >= today"
// sync below stops touching an event the moment its date is past, so the results that
// rescrape-upcoming.ts catches up on afterwards (the main card of an American event runs past
// 00:00 UTC; Sherdog can take a while to post results) used to land in the JSON but never in
// Neon: the event page stayed without results and the winner's page still listed the fight
// as their next one (UFC Fight Night 289, Rosas Jr. vs. Barcelos).
async function syncRecentPastResults(dataset: ScrapedOrgData, today: string) {
  const pendingRows = (await sql`
    SELECT DISTINCT e.id, e.name, e.date::text AS date
    FROM events e JOIN fights f ON f.event_id = e.id
    WHERE e.organization_id = ${dataset.organization_id} AND e.date < ${today} AND f.fight_finished = false
  `) as { id: number; name: string; date: string }[];

  for (const row of pendingRows) {
    if (!isRecentPastDate(row.date)) continue;
    // By name first; else by date, since Sherdog may have renamed the event since the last sync.
    const sameDate = dataset.events.filter((e) => e.date === row.date);
    const event = dataset.events.find((e) => e.name === row.name) ?? (sameDate.length === 1 ? sameDate[0] : undefined);
    if (!event) continue;
    // Nothing new to push until the JSON itself has results for this card.
    if (!dataset.fights.some((f) => f.event_name === event.name && f.fight_finished)) continue;

    if (event.name !== row.name) {
      console.log(`  renaming past event "${row.name}" -> "${event.name}"`);
      await sql`UPDATE events SET name = ${event.name} WHERE id = ${row.id}`;
    }
    await syncEvent(dataset, event);
  }
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  console.log(`Syncing events with date >= ${today}, plus results of recently-past events...`);

  for (const dataset of datasets) {
    await syncRecentPastResults(dataset, today);

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
      await syncEvent(dataset, event);
    }
  }

  console.log('Done.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
