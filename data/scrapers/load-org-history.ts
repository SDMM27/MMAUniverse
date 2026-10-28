// data/scrapers/load-org-history.ts
//
// One-off backfill of the past events (and their fights) that data/scraped/{org}.json holds but
// Neon never received: sync-upcoming-to-db.ts only ever inserts upcoming events, so orgs added
// after the initial seed (Cage Warriors, RIZIN, KSW, ACA, Invicta, LFA) only had the handful of
// cards synced since automation started -- ACA 7 of 288 events, Invicta 0 of 67.
//
// No duplicates by construction:
//   - an event already in Neon (same name, any org -- or same org and date, i.e. renamed since)
//     is left alone entirely, fights included: the regular sync owns it;
//   - a fighter is matched to an existing row before any is created -- by Sherdog URL, else by
//     name (a row with a *different* Sherdog URL is a homonym, not a match), preferring this
//     org's row, then the oldest one, as sync-upcoming-to-db.ts's upsertFighter does;
//   - each event is inserted together with its fights in one statement, so an interrupted run
//     never leaves an event without fights that a re-run would then skip.
// Fights the JSON still has as unfinished are not loaded: every event here is past, and the
// fighter page takes any unfinished fight as the fighter's next one (data.ts, no date filter).
//
// Dry run by default (counts only); pass --apply to write.
//   npx tsx data/scrapers/load-org-history.ts cagewarriors rizin ksw aca invicta lfa [--apply]
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';
import { ORG_CONFIGS } from './orgs.config';
import { currentRecord } from './shared/fighter-record';
import type { ScrapedFighter, ScrapedOrgData } from './shared/types';

dotenv.config({ path: path.resolve('.env.local') });
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set (expected in .env.local)');
  process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);

const EVENTS_PER_STATEMENT = 25;

type DbFighter = { id: number; name: string; organization_id: number; sherdog_url: string | null };

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function pickFighter(candidates: DbFighter[], orgId: number): DbFighter | undefined {
  return [...candidates].sort((a, b) => Number(b.organization_id === orgId) - Number(a.organization_id === orgId) || a.id - b.id)[0];
}

async function loadOrg(key: string, apply: boolean, today: string) {
  const config = ORG_CONFIGS.find((c) => c.orgKey === key);
  if (!config) throw new Error(`Unknown org key "${key}"`);
  const data: ScrapedOrgData = JSON.parse(fs.readFileSync(path.resolve('data/scraped', `${key}.json`), 'utf-8'));
  const orgId = config.organizationId;

  const dbEvents = (await sql`SELECT name, date::text AS date, organization_id FROM events`) as { name: string; date: string; organization_id: number }[];
  const eventNames = new Set(dbEvents.map((e) => e.name));
  const orgDates = new Set(dbEvents.filter((e) => e.organization_id === orgId).map((e) => e.date));

  const skippedRenamed: string[] = [];
  const newEvents = data.events.filter((e) => {
    if (e.date >= today || eventNames.has(e.name)) return false;
    if (orgDates.has(e.date)) {
      skippedRenamed.push(`${e.date} ${e.name}`);
      return false;
    }
    return true;
  });
  const newEventNames = new Set(newEvents.map((e) => e.name));

  // One row per event and fighter pair, results only.
  const seenPairs = new Set<string>();
  let unfinished = 0;
  const fights = data.fights.filter((f) => {
    if (!newEventNames.has(f.event_name)) return false;
    if (!f.fight_finished) {
      unfinished++;
      return false;
    }
    const pair = `${f.event_name}\u0000${[f.fighter1_name, f.fighter2_name].sort().join('\u0000')}`;
    if (seenPairs.has(pair)) return false;
    seenPairs.add(pair);
    return true;
  });

  // Resolve every fighter name to an existing row, or queue a new one.
  const dbFighters = (await sql`SELECT id, name, organization_id, sherdog_url FROM fighters`) as DbFighter[];
  const byUrl = new Map<string, DbFighter[]>();
  const byName = new Map<string, DbFighter[]>();
  for (const f of dbFighters) {
    if (f.sherdog_url) byUrl.set(f.sherdog_url, [...(byUrl.get(f.sherdog_url) ?? []), f]);
    byName.set(f.name, [...(byName.get(f.name) ?? []), f]);
  }
  const jsonFighters = new Map<string, ScrapedFighter>();
  for (const f of data.fighters) if (!jsonFighters.has(f.name)) jsonFighters.set(f.name, f);
  const weightClassOf = new Map<string, string>();
  for (const f of fights) {
    weightClassOf.set(f.fighter1_name, weightClassOf.get(f.fighter1_name) || f.weight_class);
    weightClassOf.set(f.fighter2_name, weightClassOf.get(f.fighter2_name) || f.weight_class);
  }

  const fighterIds = new Map<string, number>();
  const toCreate: { name: string; weight_class: string; record: string; sherdog_url: string | null }[] = [];
  let byUrlMatches = 0;
  let byNameMatches = 0;
  for (const name of Array.from(weightClassOf.keys())) {
    const json = jsonFighters.get(name);
    const url = json?.sherdog_url || null;
    const urlMatch = url ? pickFighter(byUrl.get(url) ?? [], orgId) : undefined;
    const nameMatch = pickFighter((byName.get(name) ?? []).filter((f) => !url || !f.sherdog_url || f.sherdog_url === url), orgId);
    const match = urlMatch ?? nameMatch;
    if (match) {
      fighterIds.set(name, match.id);
      if (urlMatch) byUrlMatches++;
      else byNameMatches++;
      continue;
    }
    toCreate.push({
      name,
      weight_class: json?.weight_class || weightClassOf.get(name) || '',
      record: json ? currentRecord(json) : '',
      sherdog_url: url,
    });
  }

  let unmatchedWinners = 0;
  for (const f of fights) if (f.winner_name && f.winner_name !== f.fighter1_name && f.winner_name !== f.fighter2_name) unmatchedWinners++;
  const loadedEvents = newEvents.filter((e) => fights.some((f) => f.event_name === e.name));

  console.log(
    `[${key}] ${loadedEvents.length} event(s) to load (${data.events.length} in JSON), ${fights.length} fight(s), ` +
      `${unfinished} unfinished skipped; fighters: ${byUrlMatches} matched by Sherdog URL, ${byNameMatches} by name, ` +
      `${toCreate.length} new (${toCreate.filter((f) => f.sherdog_url).length} with a Sherdog URL)` +
      (unmatchedWinners ? `; ${unmatchedWinners} winner(s) matching neither side` : ''),
  );
  for (const e of skippedRenamed) console.log(`  [${key}] skipped (same date as an event already in Neon): ${e}`);
  if (!apply) return;

  for (const batch of chunk(toCreate, 500)) {
    const created = (await sql`
      INSERT INTO fighters (name, weight_class, organization_id, record, ranking, sherdog_url)
      SELECT n, w, ${orgId}, r, 0, u FROM UNNEST(
        ${batch.map((f) => f.name)}::varchar[], ${batch.map((f) => f.weight_class)}::varchar[],
        ${batch.map((f) => f.record)}::varchar[], ${batch.map((f) => f.sherdog_url)}::varchar[]
      ) AS t(n, w, r, u)
      RETURNING id, name
    `) as { id: number; name: string }[];
    for (const row of created) fighterIds.set(row.name, row.id);
  }

  for (const batch of chunk(loadedEvents, EVENTS_PER_STATEMENT)) {
    const names = new Set(batch.map((e) => e.name));
    const rows = fights.filter((f) => names.has(f.event_name));
    const idOf = (name: string) => {
      const id = fighterIds.get(name);
      if (id === undefined) throw new Error(`[${key}] no fighter id for "${name}"`);
      return id;
    };
    await sql`
      WITH ev AS (
        INSERT INTO events (name, date, start_time, event_location, event_poster, organization_id)
        SELECT n, d, s, l, '', ${orgId} FROM UNNEST(
          ${batch.map((e) => e.name)}::varchar[], ${batch.map((e) => e.date)}::varchar[],
          ${batch.map((e) => e.start_time ?? null)}::timestamptz[], ${batch.map((e) => e.event_location)}::varchar[]
        ) AS t(n, d, s, l)
        RETURNING id, name
      )
      INSERT INTO fights (event_id, fighter1_id, fighter2_id, fight_finished, winner_id, method, round, time, weight_class, is_main_event, is_title_fight)
      SELECT ev.id, f1, f2, true, w, m, r, ti, wc, me, tf
      FROM UNNEST(
        ${rows.map((f) => f.event_name)}::varchar[], ${rows.map((f) => idOf(f.fighter1_name))}::int[],
        ${rows.map((f) => idOf(f.fighter2_name))}::int[],
        ${rows.map((f) => (f.winner_name === f.fighter1_name ? idOf(f.fighter1_name) : f.winner_name === f.fighter2_name ? idOf(f.fighter2_name) : null))}::int[],
        ${rows.map((f) => f.method)}::varchar[], ${rows.map((f) => f.round)}::int[], ${rows.map((f) => f.time)}::varchar[],
        ${rows.map((f) => f.weight_class)}::varchar[], ${rows.map((f) => f.is_main_event ?? false)}::boolean[],
        ${rows.map((f) => f.is_title_fight ?? false)}::boolean[]
      ) AS t(en, f1, f2, w, m, r, ti, wc, me, tf)
      JOIN ev ON ev.name = t.en
    `;
  }
  console.log(`[${key}] written.`);
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const keys = args.filter((a) => !a.startsWith('--'));
  if (keys.length === 0) {
    console.error('Usage: npx tsx data/scrapers/load-org-history.ts <orgKey> [...] [--apply]');
    process.exit(1);
  }
  const today = new Date().toISOString().slice(0, 10);
  for (const key of keys) await loadOrg(key, apply, today);
  if (!apply) console.log('Dry run: nothing written. Re-run with --apply.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
