// data/scrapers/sync-fighter-history.ts
//
// Pushes each fighter's Sherdog-sourced `sherdog_url` + `fight_history` (see
// data/scrapers/parse.ts's parseFighterFightHistory) from every data/scraped/{org}.json
// into Neon. This is what actually backfills a fighter page's history once
// backfill-fighter-history.ts (or a normal scrape/rescrape) has populated those fields in
// the JSON — safe to re-run: matches existing `fighters` rows by name + organization_id
// (same natural key seed-additional-orgs.ts's findFighterId uses) rather than creating new
// ones, and upserts fighter_fight_history by its own natural key so nothing duplicates.
import fs from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';
import { ORG_CONFIGS } from './orgs.config';
import type { ScrapedOrgData } from './shared/types';

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

async function findFighterId(name: string, organizationId: number): Promise<number | null> {
  const res = (await sql`
    SELECT id FROM fighters WHERE name = ${name} AND organization_id = ${organizationId}
  `) as { id: number }[];
  return res[0]?.id ?? null;
}

async function main() {
  await ensureSchema();

  let fightersUpdated = 0;
  let historyRows = 0;

  for (const config of ORG_CONFIGS) {
    const dataset = loadDataset(config.orgKey);
    if (!dataset) continue;

    for (const fighter of dataset.fighters) {
      if (!fighter.sherdog_url) continue; // not yet backfilled for this fighter

      const fighterId = await findFighterId(fighter.name, config.organizationId);
      if (!fighterId) continue; // fighter isn't synced into this org yet — the regular sync scripts own creating that row

      await sql`UPDATE fighters SET sherdog_url = ${fighter.sherdog_url} WHERE id = ${fighterId}`;
      fightersUpdated++;

      for (const entry of fighter.fight_history ?? []) {
        await sql`
          INSERT INTO fighter_fight_history
            (fighter_id, opponent_name, opponent_sherdog_url, event_name, event_sherdog_url, event_date, result, method, referee, round, time)
          VALUES
            (${fighterId}, ${entry.opponent_name}, ${entry.opponent_sherdog_url || null}, ${entry.event_name}, ${entry.event_sherdog_url || null},
             ${entry.date || null}, ${entry.result}, ${entry.method || null}, ${entry.referee || null}, ${entry.round || null}, ${entry.time || null})
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
        historyRows++;
      }
    }
    console.log(`[${config.orgKey}] processed.`);
  }

  console.log(`Done. ${fightersUpdated} fighter row(s) updated with a sherdog_url, ${historyRows} history row(s) upserted.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
