// data/scrapers/sync-fighter-stats.ts
//
// Pushes data/scraped/ufcstats-fight-stats.json (see scrape-ufcstats.ts) into
// Neon: sets fighters.ufcstats_url for every fighter it can match, and
// upserts one fighter_fight_stats row per (fighter, fight) pair. UFC-only —
// UFCStats doesn't cover any other organization, so every match is scoped to
// organization_id = 1 (see data/scrapers/orgs.config.ts). Safe to re-run:
// matches existing `fighters` rows by name + organization_id (exact, then
// fuzzy -- see resolveFighterIds) and upserts
// fighter_fight_stats by its own natural key (fighter_id, ufcstats_fight_url).
import fs from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';
import type { UfcStatsFightRecord } from './shared/ufcstats-types';
import { matchFighterByName } from './ranking-name-match';
import { loadUfcStatsBonuses } from './shared/ufcstats-bonuses';

const UFC_ORGANIZATION_ID = 1;

// tsx doesn't auto-load .env.local the way Next.js does; parse it by hand
// (duplicated from sync-fighter-history.ts rather than shared, matching that
// script's own note on why: it's a few lines, not worth a module for it).
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
  await sql`ALTER TABLE fighters ADD COLUMN IF NOT EXISTS ufcstats_url VARCHAR(500);`;
  await sql`
    CREATE TABLE IF NOT EXISTS fighter_fight_stats (
      id SERIAL PRIMARY KEY,
      fighter_id INT NOT NULL REFERENCES fighters(id) ON DELETE CASCADE,
      opponent_name VARCHAR(255) NOT NULL,
      event_name VARCHAR(255) NOT NULL,
      event_date VARCHAR(255),
      ufcstats_fight_url VARCHAR(500) NOT NULL,
      result VARCHAR(10),
      knockdowns INT NOT NULL DEFAULT 0,
      sig_strikes_landed INT NOT NULL DEFAULT 0,
      sig_strikes_attempted INT NOT NULL DEFAULT 0,
      total_strikes_landed INT NOT NULL DEFAULT 0,
      total_strikes_attempted INT NOT NULL DEFAULT 0,
      takedowns_landed INT NOT NULL DEFAULT 0,
      takedowns_attempted INT NOT NULL DEFAULT 0,
      submission_attempts INT NOT NULL DEFAULT 0,
      reversals INT NOT NULL DEFAULT 0,
      control_time_seconds INT,
      sig_strikes_head_landed INT NOT NULL DEFAULT 0,
      sig_strikes_head_attempted INT NOT NULL DEFAULT 0,
      sig_strikes_body_landed INT NOT NULL DEFAULT 0,
      sig_strikes_body_attempted INT NOT NULL DEFAULT 0,
      sig_strikes_leg_landed INT NOT NULL DEFAULT 0,
      sig_strikes_leg_attempted INT NOT NULL DEFAULT 0,
      sig_strikes_distance_landed INT NOT NULL DEFAULT 0,
      sig_strikes_distance_attempted INT NOT NULL DEFAULT 0,
      sig_strikes_clinch_landed INT NOT NULL DEFAULT 0,
      sig_strikes_clinch_attempted INT NOT NULL DEFAULT 0,
      sig_strikes_ground_landed INT NOT NULL DEFAULT 0,
      sig_strikes_ground_attempted INT NOT NULL DEFAULT 0,
      UNIQUE (fighter_id, ufcstats_fight_url)
    );
  `;
  // Added for the FightScore rating engine (see docs/superpowers/specs/
  // 2026-09-14-fighter-rating-algorithm-design.md): weight_class groups
  // fighters into divisions per-fight (fighters.weight_class is freeform
  // Sherdog text, not reliable for that -- see the spec's "normalisation des
  // divisions" section); method/finish_round/finish_time/scheduled_rounds
  // feed computeDominanceScore and the point-flow engine's 5-round bonus.
  await sql`ALTER TABLE fighter_fight_stats ADD COLUMN IF NOT EXISTS weight_class VARCHAR(100);`;
  await sql`ALTER TABLE fighter_fight_stats ADD COLUMN IF NOT EXISTS is_title_fight BOOLEAN;`;
  await sql`ALTER TABLE fighter_fight_stats ADD COLUMN IF NOT EXISTS method VARCHAR(50);`;
  await sql`ALTER TABLE fighter_fight_stats ADD COLUMN IF NOT EXISTS finish_round INT;`;
  await sql`ALTER TABLE fighter_fight_stats ADD COLUMN IF NOT EXISTS finish_time VARCHAR(10);`;
  await sql`ALTER TABLE fighter_fight_stats ADD COLUMN IF NOT EXISTS scheduled_rounds INT;`;
  // Added 2026-09-29: UFC Fight / Performance of the Night, see scrape-ufcstats-bonuses.ts.
  await sql`ALTER TABLE fighter_fight_stats ADD COLUMN IF NOT EXISTS bonus_fotn BOOLEAN NOT NULL DEFAULT false;`;
  await sql`ALTER TABLE fighter_fight_stats ADD COLUMN IF NOT EXISTS bonus_potn BOOLEAN NOT NULL DEFAULT false;`;
  await sql`
    CREATE TABLE IF NOT EXISTS fighter_fight_round_stats (
      id SERIAL PRIMARY KEY,
      fighter_fight_stats_id INT NOT NULL REFERENCES fighter_fight_stats(id) ON DELETE CASCADE,
      round INT NOT NULL,
      knockdowns INT NOT NULL DEFAULT 0,
      sig_strikes_landed INT NOT NULL DEFAULT 0,
      sig_strikes_attempted INT NOT NULL DEFAULT 0,
      total_strikes_landed INT NOT NULL DEFAULT 0,
      total_strikes_attempted INT NOT NULL DEFAULT 0,
      takedowns_landed INT NOT NULL DEFAULT 0,
      takedowns_attempted INT NOT NULL DEFAULT 0,
      submission_attempts INT NOT NULL DEFAULT 0,
      reversals INT NOT NULL DEFAULT 0,
      control_time_seconds INT,
      UNIQUE (fighter_fight_stats_id, round)
    );
  `;
}

function loadRecords(): UfcStatsFightRecord[] {
  const file = path.resolve('data/scraped/ufcstats-fight-stats.json');
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

/**
 * UFCStats fighter name -> fighters.id, for every name in the scraped file.
 * Exact name first; otherwise matchFighterByName's fuzzy levels (UFCStats'
 * spelling often differs from our Sherdog-sourced names -- "Benoit Saint
 * Denis" vs "Benoit St. Denis"), restricted to fighters no other scraped name
 * matches exactly, and accepted only when no other scraped name fuzzily lands
 * on the same fighter (never merge two people into one row).
 */
async function resolveFighterIds(records: UfcStatsFightRecord[]): Promise<Map<string, number>> {
  const fighters = (await sql`
    SELECT id, name FROM fighters WHERE organization_id = ${UFC_ORGANIZATION_ID}
  `) as { id: number; name: string }[];
  const scrapedNames = Array.from(new Set(records.map((r) => r.fighter_name)));
  const idByExactName = new Map(fighters.map((f) => [f.name, f.id]));

  const resolved = new Map<string, number>();
  for (const name of scrapedNames) if (idByExactName.has(name)) resolved.set(name, idByExactName.get(name)!);
  const claimed = new Set(resolved.values());
  const unclaimed = fighters.filter((f) => !claimed.has(f.id));

  const fuzzy = new Map<string, number>();
  const claimsById = new Map<number, number>();
  for (const name of scrapedNames) {
    if (resolved.has(name)) continue;
    const match = matchFighterByName(name, unclaimed);
    if (!match) continue;
    fuzzy.set(name, match.id);
    claimsById.set(match.id, (claimsById.get(match.id) ?? 0) + 1);
  }
  for (const [name, id] of Array.from(fuzzy.entries())) {
    if (claimsById.get(id) !== 1) continue;
    const fighterName = fighters.find((f) => f.id === id)!.name;
    console.log(`  Matched "${name}" -> "${fighterName}"`);
    resolved.set(name, id);
  }
  return resolved;
}

// Rows per multi-row statement. Each statement is one HTTP round trip to Neon; going row by row
// (~75k round trips for the full UFCStats history) made the daily run take ~1.5 hours of Actions minutes.
const BATCH_SIZE = 500;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

type MatchedRecord = { fighterId: number; record: UfcStatsFightRecord };

async function main() {
  await ensureSchema();

  const records = loadRecords();
  const fighterIdByName = await resolveFighterIds(records);
  let unmatched = 0;

  // Keyed on each table's unique constraint: a single INSERT ... ON CONFLICT DO UPDATE can't touch
  // the same row twice, so duplicates are collapsed here (last one wins, as with row-by-row upserts).
  const ufcstatsUrlByFighterId = new Map<number, string>();
  const matchedByKey = new Map<string, MatchedRecord>();
  for (const record of records) {
    const fighterId = fighterIdByName.get(record.fighter_name);
    if (!fighterId) {
      unmatched++;
      continue; // fighter isn't synced into the UFC org yet — the regular sync scripts own creating that row
    }
    ufcstatsUrlByFighterId.set(fighterId, record.fighter_ufcstats_url);
    matchedByKey.set(`${fighterId}|${record.ufcstats_fight_url}`, { fighterId, record });
  }

  for (const batch of chunk(Array.from(ufcstatsUrlByFighterId), BATCH_SIZE)) {
    await sql`
      UPDATE fighters f SET ufcstats_url = u.ufcstats_url
      FROM UNNEST(${batch.map(([id]) => id)}::int[], ${batch.map(([, url]) => url)}::text[]) AS u(id, ufcstats_url)
      WHERE f.id = u.id AND f.ufcstats_url IS DISTINCT FROM u.ufcstats_url
    `;
  }

  const statsIdByKey = new Map<string, number>();
  for (const batch of chunk(Array.from(matchedByKey.values()), BATCH_SIZE)) {
    const col = <T>(pick: (m: MatchedRecord) => T): T[] => batch.map(pick);
    const inserted = (await sql`
      INSERT INTO fighter_fight_stats
        (fighter_id, opponent_name, event_name, event_date, ufcstats_fight_url, result,
         weight_class, is_title_fight, method, finish_round, finish_time, scheduled_rounds,
         knockdowns, sig_strikes_landed, sig_strikes_attempted, total_strikes_landed, total_strikes_attempted,
         takedowns_landed, takedowns_attempted, submission_attempts, reversals, control_time_seconds,
         sig_strikes_head_landed, sig_strikes_head_attempted, sig_strikes_body_landed, sig_strikes_body_attempted,
         sig_strikes_leg_landed, sig_strikes_leg_attempted, sig_strikes_distance_landed, sig_strikes_distance_attempted,
         sig_strikes_clinch_landed, sig_strikes_clinch_attempted, sig_strikes_ground_landed, sig_strikes_ground_attempted)
      SELECT * FROM UNNEST(
        ${col((m) => m.fighterId)}::int[],
        ${col((m) => m.record.opponent_name)}::varchar[],
        ${col((m) => m.record.event_name)}::varchar[],
        ${col((m) => m.record.event_date || null)}::varchar[],
        ${col((m) => m.record.ufcstats_fight_url)}::varchar[],
        ${col((m) => m.record.result)}::varchar[],
        ${col((m) => m.record.weight_class || null)}::varchar[],
        ${col((m) => m.record.is_title_fight ?? null)}::boolean[],
        ${col((m) => m.record.method || null)}::varchar[],
        ${col((m) => m.record.round || null)}::int[],
        ${col((m) => m.record.time || null)}::varchar[],
        ${col((m) => m.record.scheduled_rounds || null)}::int[],
        ${col((m) => m.record.totals.knockdowns)}::int[],
        ${col((m) => m.record.totals.sigStrikes.landed)}::int[],
        ${col((m) => m.record.totals.sigStrikes.attempted)}::int[],
        ${col((m) => m.record.totals.totalStrikes.landed)}::int[],
        ${col((m) => m.record.totals.totalStrikes.attempted)}::int[],
        ${col((m) => m.record.totals.takedowns.landed)}::int[],
        ${col((m) => m.record.totals.takedowns.attempted)}::int[],
        ${col((m) => m.record.totals.submissionAttempts)}::int[],
        ${col((m) => m.record.totals.reversals)}::int[],
        ${col((m) => m.record.totals.controlTimeSeconds)}::int[],
        ${col((m) => m.record.strikes.head.landed)}::int[],
        ${col((m) => m.record.strikes.head.attempted)}::int[],
        ${col((m) => m.record.strikes.body.landed)}::int[],
        ${col((m) => m.record.strikes.body.attempted)}::int[],
        ${col((m) => m.record.strikes.leg.landed)}::int[],
        ${col((m) => m.record.strikes.leg.attempted)}::int[],
        ${col((m) => m.record.strikes.distance.landed)}::int[],
        ${col((m) => m.record.strikes.distance.attempted)}::int[],
        ${col((m) => m.record.strikes.clinch.landed)}::int[],
        ${col((m) => m.record.strikes.clinch.attempted)}::int[],
        ${col((m) => m.record.strikes.ground.landed)}::int[],
        ${col((m) => m.record.strikes.ground.attempted)}::int[]
      )
      ON CONFLICT (fighter_id, ufcstats_fight_url) DO UPDATE SET
        opponent_name = EXCLUDED.opponent_name,
        event_name = EXCLUDED.event_name,
        event_date = EXCLUDED.event_date,
        result = EXCLUDED.result,
        weight_class = EXCLUDED.weight_class,
        is_title_fight = EXCLUDED.is_title_fight,
        method = EXCLUDED.method,
        finish_round = EXCLUDED.finish_round,
        finish_time = EXCLUDED.finish_time,
        scheduled_rounds = EXCLUDED.scheduled_rounds,
        knockdowns = EXCLUDED.knockdowns,
        sig_strikes_landed = EXCLUDED.sig_strikes_landed,
        sig_strikes_attempted = EXCLUDED.sig_strikes_attempted,
        total_strikes_landed = EXCLUDED.total_strikes_landed,
        total_strikes_attempted = EXCLUDED.total_strikes_attempted,
        takedowns_landed = EXCLUDED.takedowns_landed,
        takedowns_attempted = EXCLUDED.takedowns_attempted,
        submission_attempts = EXCLUDED.submission_attempts,
        reversals = EXCLUDED.reversals,
        control_time_seconds = EXCLUDED.control_time_seconds,
        sig_strikes_head_landed = EXCLUDED.sig_strikes_head_landed,
        sig_strikes_head_attempted = EXCLUDED.sig_strikes_head_attempted,
        sig_strikes_body_landed = EXCLUDED.sig_strikes_body_landed,
        sig_strikes_body_attempted = EXCLUDED.sig_strikes_body_attempted,
        sig_strikes_leg_landed = EXCLUDED.sig_strikes_leg_landed,
        sig_strikes_leg_attempted = EXCLUDED.sig_strikes_leg_attempted,
        sig_strikes_distance_landed = EXCLUDED.sig_strikes_distance_landed,
        sig_strikes_distance_attempted = EXCLUDED.sig_strikes_distance_attempted,
        sig_strikes_clinch_landed = EXCLUDED.sig_strikes_clinch_landed,
        sig_strikes_clinch_attempted = EXCLUDED.sig_strikes_clinch_attempted,
        sig_strikes_ground_landed = EXCLUDED.sig_strikes_ground_landed,
        sig_strikes_ground_attempted = EXCLUDED.sig_strikes_ground_attempted
      RETURNING id, fighter_id, ufcstats_fight_url
    `) as { id: number; fighter_id: number; ufcstats_fight_url: string }[];
    for (const row of inserted) statsIdByKey.set(`${row.fighter_id}|${row.ufcstats_fight_url}`, row.id);
  }

  const roundsByKey = new Map<string, { statsId: number; round: UfcStatsFightRecord['rounds'][number] }>();
  for (const [key, { record }] of Array.from(matchedByKey)) {
    const statsId = statsIdByKey.get(key)!;
    for (const round of record.rounds ?? []) roundsByKey.set(`${statsId}|${round.round}`, { statsId, round });
  }

  for (const batch of chunk(Array.from(roundsByKey.values()), BATCH_SIZE)) {
    await sql`
      INSERT INTO fighter_fight_round_stats
        (fighter_fight_stats_id, round, knockdowns, sig_strikes_landed, sig_strikes_attempted,
         total_strikes_landed, total_strikes_attempted, takedowns_landed, takedowns_attempted,
         submission_attempts, reversals, control_time_seconds)
      SELECT * FROM UNNEST(
        ${batch.map((b) => b.statsId)}::int[],
        ${batch.map((b) => b.round.round)}::int[],
        ${batch.map((b) => b.round.knockdowns)}::int[],
        ${batch.map((b) => b.round.sigStrikes.landed)}::int[],
        ${batch.map((b) => b.round.sigStrikes.attempted)}::int[],
        ${batch.map((b) => b.round.totalStrikes.landed)}::int[],
        ${batch.map((b) => b.round.totalStrikes.attempted)}::int[],
        ${batch.map((b) => b.round.takedowns.landed)}::int[],
        ${batch.map((b) => b.round.takedowns.attempted)}::int[],
        ${batch.map((b) => b.round.submissionAttempts)}::int[],
        ${batch.map((b) => b.round.reversals)}::int[],
        ${batch.map((b) => b.round.controlTimeSeconds)}::int[]
      )
      ON CONFLICT (fighter_fight_stats_id, round) DO UPDATE SET
        knockdowns = EXCLUDED.knockdowns,
        sig_strikes_landed = EXCLUDED.sig_strikes_landed,
        sig_strikes_attempted = EXCLUDED.sig_strikes_attempted,
        total_strikes_landed = EXCLUDED.total_strikes_landed,
        total_strikes_attempted = EXCLUDED.total_strikes_attempted,
        takedowns_landed = EXCLUDED.takedowns_landed,
        takedowns_attempted = EXCLUDED.takedowns_attempted,
        submission_attempts = EXCLUDED.submission_attempts,
        reversals = EXCLUDED.reversals,
        control_time_seconds = EXCLUDED.control_time_seconds
    `;
  }

  // Bonuses are fight-level (both fighters' rows carry them; the rating reads the winner's), so
  // they're matched to rows by fight URL. The file only lists fights that earned one, so a fight
  // whose bonus disappeared is reset by first clearing every walked fight's flags.
  const bonuses = loadUfcStatsBonuses().fights;
  const bonusUrls = Object.keys(bonuses);
  await sql`UPDATE fighter_fight_stats SET bonus_fotn = false, bonus_potn = false WHERE bonus_fotn OR bonus_potn`;
  for (const batch of chunk(bonusUrls, BATCH_SIZE)) {
    await sql`
      UPDATE fighter_fight_stats f SET bonus_fotn = u.fotn, bonus_potn = u.potn
      FROM UNNEST(${batch}::text[], ${batch.map((url) => bonuses[url].fightOfTheNight)}::boolean[], ${batch.map((url) => bonuses[url].performanceOfTheNight)}::boolean[]) AS u(url, fotn, potn)
      WHERE f.ufcstats_fight_url = u.url
    `;
  }

  console.log(`Done. ${bonusUrls.length} fight(s) with a bonus applied, ${ufcstatsUrlByFighterId.size} fighter row(s) checked for a ufcstats_url, ${matchedByKey.size} stats row(s) upserted, ${roundsByKey.size} round-stat row(s) upserted, ${unmatched} record(s) skipped (fighter not found in UFC org).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
