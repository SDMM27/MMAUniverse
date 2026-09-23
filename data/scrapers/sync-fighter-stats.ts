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

async function main() {
  await ensureSchema();

  const records = loadRecords();
  const fighterIdByName = await resolveFighterIds(records);
  let fightersUpdated = 0;
  let statsRows = 0;
  let roundRows = 0;
  let unmatched = 0;

  for (const record of records) {
    const fighterId = fighterIdByName.get(record.fighter_name);
    if (!fighterId) {
      unmatched++;
      continue; // fighter isn't synced into the UFC org yet — the regular sync scripts own creating that row
    }

    await sql`UPDATE fighters SET ufcstats_url = ${record.fighter_ufcstats_url} WHERE id = ${fighterId} AND ufcstats_url IS DISTINCT FROM ${record.fighter_ufcstats_url}`;
    fightersUpdated++;

    const t = record.totals;
    const s = record.strikes;
    const [statsRow] = (await sql`
      INSERT INTO fighter_fight_stats
        (fighter_id, opponent_name, event_name, event_date, ufcstats_fight_url, result,
         weight_class, is_title_fight, method, finish_round, finish_time, scheduled_rounds,
         knockdowns, sig_strikes_landed, sig_strikes_attempted, total_strikes_landed, total_strikes_attempted,
         takedowns_landed, takedowns_attempted, submission_attempts, reversals, control_time_seconds,
         sig_strikes_head_landed, sig_strikes_head_attempted, sig_strikes_body_landed, sig_strikes_body_attempted,
         sig_strikes_leg_landed, sig_strikes_leg_attempted, sig_strikes_distance_landed, sig_strikes_distance_attempted,
         sig_strikes_clinch_landed, sig_strikes_clinch_attempted, sig_strikes_ground_landed, sig_strikes_ground_attempted)
      VALUES
        (${fighterId}, ${record.opponent_name}, ${record.event_name}, ${record.event_date || null}, ${record.ufcstats_fight_url}, ${record.result},
         ${record.weight_class || null}, ${record.is_title_fight ?? null}, ${record.method || null}, ${record.round || null}, ${record.time || null}, ${record.scheduled_rounds || null},
         ${t.knockdowns}, ${t.sigStrikes.landed}, ${t.sigStrikes.attempted}, ${t.totalStrikes.landed}, ${t.totalStrikes.attempted},
         ${t.takedowns.landed}, ${t.takedowns.attempted}, ${t.submissionAttempts}, ${t.reversals}, ${t.controlTimeSeconds},
         ${s.head.landed}, ${s.head.attempted}, ${s.body.landed}, ${s.body.attempted},
         ${s.leg.landed}, ${s.leg.attempted}, ${s.distance.landed}, ${s.distance.attempted},
         ${s.clinch.landed}, ${s.clinch.attempted}, ${s.ground.landed}, ${s.ground.attempted})
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
      RETURNING id
    `) as { id: number }[];
    statsRows++;

    for (const r of record.rounds ?? []) {
      await sql`
        INSERT INTO fighter_fight_round_stats
          (fighter_fight_stats_id, round, knockdowns, sig_strikes_landed, sig_strikes_attempted,
           total_strikes_landed, total_strikes_attempted, takedowns_landed, takedowns_attempted,
           submission_attempts, reversals, control_time_seconds)
        VALUES
          (${statsRow.id}, ${r.round}, ${r.knockdowns}, ${r.sigStrikes.landed}, ${r.sigStrikes.attempted},
           ${r.totalStrikes.landed}, ${r.totalStrikes.attempted}, ${r.takedowns.landed}, ${r.takedowns.attempted},
           ${r.submissionAttempts}, ${r.reversals}, ${r.controlTimeSeconds})
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
      roundRows++;
    }
  }

  console.log(`Done. ${fightersUpdated} fighter row(s) updated with a ufcstats_url, ${statsRows} stats row(s) upserted, ${roundRows} round-stat row(s) upserted, ${unmatched} record(s) skipped (fighter not found in UFC org).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
