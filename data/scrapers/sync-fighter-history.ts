// data/scrapers/sync-fighter-history.ts
//
// Pushes each fighter's Sherdog-sourced `sherdog_url` + `fight_history` (see
// data/scrapers/parse.ts's parseFighterFightHistory) from every data/scraped/{org}.json
// into Neon. This is what actually backfills a fighter page's history once
// backfill-fighter-history.ts (or a normal scrape/rescrape) has populated those fields in
// the JSON — safe to re-run: matches existing `fighters` rows by name + organization_id
// (same natural key seed-additional-orgs.ts's findFighterId uses) rather than creating new
// ones, and upserts fighter_fight_history by its own natural key so nothing duplicates.
//
// Run with no args (as daily-sync.yml does) to sync every fighter in every org — ~200k history
// rows, pushed as multi-row UNNEST statements of BATCH_SIZE rows each (a few hundred round trips,
// not one per row). The event-day workflow doesn't need all of that, so it instead passes
// `<orgKey> --live` (or an explicit `--date=YYYY-MM-DD[,YYYY-MM-DD]`) — see sync-live-fighter-history.ts, which refreshes
// the same fighters' JSON right before this runs — to scope the push down to just the handful of
// fighters who fought that day in that org. `--live` = today plus, overnight, yesterday (see
// shared/live-dates.ts: an American card runs past 00:00 UTC).
import fs from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';
import { ORG_CONFIGS } from './orgs.config';
import { liveEventDates } from './shared/live-dates';
import type { ScrapedOrgData } from './shared/types';
import { currentRecord } from './shared/fighter-record';

// tsx doesn't auto-load .env.local the way Next.js does; parse it by hand.
// (duplicated from sync-upcoming-to-db.ts rather than shared, matching that
// script's own note on why: it's a few lines, not worth a module for it)
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

async function ensureSchema() {
  await sql`ALTER TABLE fighters ADD COLUMN IF NOT EXISTS sherdog_url VARCHAR(500);`;
  await sql`
    CREATE TABLE IF NOT EXISTS fighter_fight_history (
      id SERIAL PRIMARY KEY,
      fighter_id INT NOT NULL REFERENCES fighters(id) ON DELETE CASCADE,
      opponent_name VARCHAR(255) NOT NULL,
      opponent_sherdog_url VARCHAR(500),
      event_name VARCHAR(255) NOT NULL,
      event_sherdog_url VARCHAR(500),
      event_date VARCHAR(255),
      result VARCHAR(10) NOT NULL,
      method VARCHAR(150),
      referee VARCHAR(120),
      round INT,
      time VARCHAR(10),
      UNIQUE (fighter_id, event_name, opponent_name)
    );
  `;
}

function loadDataset(orgKey: string): ScrapedOrgData | null {
  const file = path.resolve('data/scraped', `${orgKey}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

// Rows per multi-row statement. Each statement is one HTTP round trip to Neon; going row by row
// (~230k round trips for the full roster) made the daily run take ~3 hours of Actions minutes.
const BATCH_SIZE = 1000;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function fighterIdsByName(organizationId: number): Promise<Map<string, number>> {
  const rows = (await sql`
    SELECT id, name FROM fighters WHERE organization_id = ${organizationId} ORDER BY id
  `) as { id: number; name: string }[];
  const ids = new Map<string, number>();
  for (const row of rows) if (!ids.has(row.name)) ids.set(row.name, row.id);
  return ids;
}

type HistoryRow = {
  fighterId: number;
  opponentName: string;
  opponentSherdogUrl: string | null;
  eventName: string;
  eventSherdogUrl: string | null;
  eventDate: string | null;
  result: string;
  method: string | null;
  referee: string | null;
  round: number | null;
  time: string | null;
};

async function main() {
  await ensureSchema();

  const rawArgs = process.argv.slice(2);
  const dateArg = rawArgs.find((a) => a.startsWith('--date='));
  const requestedKeys = rawArgs.filter((a) => !a.startsWith('--'));
  const scopedDates = rawArgs.includes('--live')
    ? liveEventDates()
    : dateArg
      ? dateArg.slice('--date='.length).split(',')
      : null;
  const configs = requestedKeys.length > 0 ? ORG_CONFIGS.filter((c) => requestedKeys.includes(c.orgKey)) : ORG_CONFIGS;

  let fightersUpdated = 0;
  let historyRows = 0;

  for (const config of configs) {
    const dataset = loadDataset(config.orgKey);
    if (!dataset) continue;

    // Event-day scoping: only push the fighters who actually fought on `scopedDates` in this
    // org, instead of every fighter this org has ever had — see the module doc comment above.
    let namesToSync: Set<string> | null = null;
    if (scopedDates) {
      const todaysEventNames = new Set(dataset.events.filter((e) => scopedDates.includes(e.date)).map((e) => e.name));
      namesToSync = new Set<string>();
      for (const fight of dataset.fights) {
        if (!todaysEventNames.has(fight.event_name)) continue;
        namesToSync.add(fight.fighter1_name);
        namesToSync.add(fight.fighter2_name);
      }
    }

    const idsByName = await fighterIdsByName(config.organizationId);
    const urlUpdates = new Map<number, { url: string; record: string }>();
    // Keyed on the table's unique constraint: a single INSERT ... ON CONFLICT DO UPDATE can't touch
    // the same row twice, so duplicates are collapsed here (last one wins, as with row-by-row upserts).
    const historyByKey = new Map<string, HistoryRow>();

    for (const fighter of dataset.fighters) {
      if (namesToSync && !namesToSync.has(fighter.name)) continue;
      if (!fighter.sherdog_url) continue; // not yet backfilled for this fighter

      const fighterId = idsByName.get(fighter.name);
      if (!fighterId) continue; // fighter isn't synced into this org yet — the regular sync scripts own creating that row

      urlUpdates.set(fighterId, { url: fighter.sherdog_url, record: currentRecord(fighter) });

      for (const entry of fighter.fight_history ?? []) {
        historyByKey.set(JSON.stringify([fighterId, entry.event_name, entry.opponent_name]), {
          fighterId,
          opponentName: entry.opponent_name,
          opponentSherdogUrl: entry.opponent_sherdog_url || null,
          eventName: entry.event_name,
          eventSherdogUrl: entry.event_sherdog_url || null,
          eventDate: entry.date || null,
          result: entry.result,
          method: entry.method || null,
          referee: entry.referee || null,
          round: entry.round || null,
          time: entry.time || null,
        });
      }
    }

    for (const batch of chunk(Array.from(urlUpdates), BATCH_SIZE)) {
      await sql`
        UPDATE fighters f SET sherdog_url = u.sherdog_url, record = u.record
        FROM UNNEST(
          ${batch.map(([id]) => id)}::int[],
          ${batch.map(([, u]) => u.url)}::text[],
          ${batch.map(([, u]) => u.record)}::text[]
        ) AS u(id, sherdog_url, record)
        WHERE f.id = u.id
      `;
    }
    fightersUpdated += urlUpdates.size;

    for (const batch of chunk(Array.from(historyByKey.values()), BATCH_SIZE)) {
      await sql`
        INSERT INTO fighter_fight_history
          (fighter_id, opponent_name, opponent_sherdog_url, event_name, event_sherdog_url, event_date, result, method, referee, round, time)
        SELECT * FROM UNNEST(
          ${batch.map((r) => r.fighterId)}::int[],
          ${batch.map((r) => r.opponentName)}::varchar[],
          ${batch.map((r) => r.opponentSherdogUrl)}::varchar[],
          ${batch.map((r) => r.eventName)}::varchar[],
          ${batch.map((r) => r.eventSherdogUrl)}::varchar[],
          ${batch.map((r) => r.eventDate)}::varchar[],
          ${batch.map((r) => r.result)}::varchar[],
          ${batch.map((r) => r.method)}::varchar[],
          ${batch.map((r) => r.referee)}::varchar[],
          ${batch.map((r) => r.round)}::int[],
          ${batch.map((r) => r.time)}::varchar[]
        )
        ON CONFLICT (fighter_id, event_name, opponent_name) DO UPDATE SET
          opponent_sherdog_url = EXCLUDED.opponent_sherdog_url,
          event_sherdog_url = EXCLUDED.event_sherdog_url,
          event_date = EXCLUDED.event_date,
          result = EXCLUDED.result,
          method = EXCLUDED.method,
          referee = EXCLUDED.referee,
          round = EXCLUDED.round,
          time = EXCLUDED.time
      `;
    }
    historyRows += historyByKey.size;
    console.log(`[${config.orgKey}] processed.`);
  }

  console.log(`Done. ${fightersUpdated} fighter row(s) updated with a sherdog_url + record, ${historyRows} history row(s) upserted.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
