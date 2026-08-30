// data/scrapers/fix-draw-nc-finished.ts
//
// One-off data correction for the bug fixed in parse.ts's parseFinalResult: before that fix,
// Sherdog's `final_result draw`/`final_result no_contest` badges weren't recognized (only
// win/loss were), so every already-completed draw or overturned no-contest was scraped with
// `fight_finished: false` — permanently showing up as a fighter's "Prochain combat" no matter
// how old the event actually was. A handful of these don't even say "Draw"/"No Contest" in their
// `method` text (e.g. a technical-decision draw scored "Technical Decision (Split)", or a
// disqualification where Sherdog rendered a `not_finished`-looking badge for both sides) — so
// this doesn't pattern-match the method text.
//
// The parser fix only prevents *new* scrapes from getting this wrong; it doesn't retroactively
// fix what's already sitting in data/scraped/*.json or in Neon. This script does that using a
// more general signal than "does the method say draw/no contest": an event page's `method` cell
// only ever gets populated once Sherdog has posted a result at all (confirmed against every
// currently-future-dated fight across every org: zero of them have a non-empty `method`, see
// parse.test.ts's "marks fights as not finished on an upcoming event"), so a *finished-but-not-
// finished-flagged* fight is unambiguously identified by "fight_finished: false with any
// non-empty `method`" — no re-scraping required.
//
// Usage: npx tsx data/scrapers/fix-draw-nc-finished.ts [--db-only|--json-only]
import fs from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';
import { ORG_CONFIGS } from './orgs.config';
import type { ScrapedOrgData } from './shared/types';

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

function fixJson(): number {
  let totalFixed = 0;
  for (const config of ORG_CONFIGS) {
    const file = path.resolve('data/scraped', `${config.orgKey}.json`);
    if (!fs.existsSync(file)) continue;
    const dataset: ScrapedOrgData = JSON.parse(fs.readFileSync(file, 'utf-8'));

    let fixed = 0;
    for (const fight of dataset.fights) {
      if (!fight.fight_finished && fight.method.trim() !== '') {
        fight.fight_finished = true;
        fixed++;
      }
    }
    if (fixed > 0) {
      fs.writeFileSync(file, JSON.stringify(dataset, null, 2));
      console.log(`[${config.orgKey}] fixed ${fixed} fight(s) in ${file}`);
    }
    totalFixed += fixed;
  }
  return totalFixed;
}

async function fixDb(): Promise<number> {
  loadEnvLocal();
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set (expected in .env.local) — skipping DB fix.');
    return 0;
  }
  const sql = neon(process.env.DATABASE_URL);
  const updated = (await sql`
    UPDATE fights
    SET fight_finished = true
    WHERE fight_finished = false
      AND method IS NOT NULL
      AND trim(method) != ''
    RETURNING id
  `) as { id: number }[];
  console.log(`[db] fixed ${updated.length} fight row(s) in Neon.`);
  return updated.length;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const jsonOnly = args.has('--json-only');
  const dbOnly = args.has('--db-only');

  if (!dbOnly) {
    const jsonFixed = fixJson();
    console.log(`Done with JSON files. ${jsonFixed} fight(s) fixed total.`);
  }
  if (!jsonOnly) {
    await fixDb();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
