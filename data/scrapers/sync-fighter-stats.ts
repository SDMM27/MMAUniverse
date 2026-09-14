// data/scrapers/sync-fighter-stats.ts
//
// Pushes data/scraped/ufcstats-fight-stats.json (see scrape-ufcstats.ts) into
// Neon: sets fighters.ufcstats_url for every fighter it can match, and
// upserts one fighter_fight_stats row per (fighter, fight) pair. UFC-only —
// UFCStats doesn't cover any other organization, so every match is scoped to
// organization_id = 1 (see data/scrapers/orgs.config.ts). Safe to re-run:
// matches existing `fighters` rows by name + organization_id (same natural
// key sync-fighter-history.ts's findFighterId uses) and upserts
// fighter_fight_stats by its own natural key (fighter_id, ufcstats_fight_url).
import fs from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';
import type { UfcStatsFightRecord } from './shared/ufcstats-types';

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
}

function loadRecords(): UfcStatsFightRecord[] {
  const file = path.resolve('data/scraped/ufcstats-fight-stats.json');
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

const fighterIdByName = new Map<string, number | null>();

async function findFighterId(name: string): Promise<number | null> {
  if (fighterIdByName.has(name)) return fighterIdByName.get(name)!;
  const res = (await sql`
    SELECT id FROM fighters WHERE name = ${name} AND organization_id = ${UFC_ORGANIZATION_ID}
  `) as { id: number }[];
  const id = res[0]?.id ?? null;
  fighterIdByName.set(name, id);
  return id;
}

async function main() {
  await ensureSchema();

  const records = loadRecords();
  let fightersUpdated = 0;
  let statsRows = 0;
  let unmatched = 0;

  for (const record of records) {
    const fighterId = await findFighterId(record.fighter_name);
    if (!fighterId) {
      unmatched++;
      continue; // fighter isn't synced into the UFC org yet — the regular sync scripts own creating that row
    }

    await sql`UPDATE fighters SET ufcstats_url = ${record.fighter_ufcstats_url} WHERE id = ${fighterId} AND ufcstats_url IS DISTINCT FROM ${record.fighter_ufcstats_url}`;
    fightersUpdated++;

    const t = record.totals;
    const s = record.strikes;
    await sql`
      INSERT INTO fighter_fight_stats
        (fighter_id, opponent_name, event_name, event_date, ufcstats_fight_url, result,
         knockdowns, sig_strikes_landed, sig_strikes_attempted, total_strikes_landed, total_strikes_attempted,
         takedowns_landed, takedowns_attempted, submission_attempts, reversals, control_time_seconds,
         sig_strikes_head_landed, sig_strikes_head_attempted, sig_strikes_body_landed, sig_strikes_body_attempted,
         sig_strikes_leg_landed, sig_strikes_leg_attempted, sig_strikes_distance_landed, sig_strikes_distance_attempted,
         sig_strikes_clinch_landed, sig_strikes_clinch_attempted, sig_strikes_ground_landed, sig_strikes_ground_attempted)
      VALUES
        (${fighterId}, ${record.opponent_name}, ${record.event_name}, ${record.event_date || null}, ${record.ufcstats_fight_url}, ${record.result},
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
    `;
    statsRows++;
  }

  console.log(`Done. ${fightersUpdated} fighter row(s) updated with a ufcstats_url, ${statsRows} stats row(s) upserted, ${unmatched} record(s) skipped (fighter not found in UFC org).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
