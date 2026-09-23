// data/scrapers/sync-fighter-physique.ts
//
// Fills fighters.height_cm / fighters.reach_cm, shown in the header of the
// fighter page (web + mobile). Two sources, because neither covers both:
//  - Sherdog: height only (it has no reach field), but every org -- one
//    fetch per unique sherdog_url, applied to every same-person row sharing it.
//  - UFCStats: height AND reach, UFC fighters only (the ones
//    sync-fighter-stats.ts already matched to a ufcstats_url). Needs the
//    headless browser, see shared/fetch-playwright.ts.
// Sherdog's height wins when both have one (it's published in cm; UFCStats
// rounds to the inch); UFCStats only fills a height Sherdog didn't have.
//
// Every row is stamped physique_*_checked_at once its page was read, found
// or not, so each page is fetched once ever: the first run is a ~2h backfill
// (resumable -- stop it and re-run, it picks up where it was), every later
// run (daily-sync.yml) only touches fighters that got a URL since.
//
// Usage: npx tsx data/scrapers/sync-fighter-physique.ts [--source=sherdog|ufcstats] [--limit=N]
import fs from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';
import { fetchAndLoad } from './shared/fetch-throttled';
import { fetchAndLoadPW, closeBrowser } from './shared/fetch-playwright';
import { parseFighterHeightCm } from './parse';
import { parseFighterPhysique } from './parse-ufcstats';

// Duplicated from sync-fighter-history.ts rather than shared — see that file's own note on why
// (tsx doesn't auto-load .env.local the way Next.js does; it's a few lines, not worth a module).
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
  await sql`ALTER TABLE fighters ADD COLUMN IF NOT EXISTS height_cm SMALLINT;`;
  await sql`ALTER TABLE fighters ADD COLUMN IF NOT EXISTS reach_cm SMALLINT;`;
  await sql`ALTER TABLE fighters ADD COLUMN IF NOT EXISTS physique_sherdog_checked_at TIMESTAMPTZ;`;
  await sql`ALTER TABLE fighters ADD COLUMN IF NOT EXISTS physique_ufcstats_checked_at TIMESTAMPTZ;`;
}

async function syncFromSherdog(limit: number | null) {
  const rows = (await sql`
    SELECT DISTINCT sherdog_url FROM fighters
    WHERE sherdog_url IS NOT NULL AND physique_sherdog_checked_at IS NULL
  `) as { sherdog_url: string }[];
  const urls = rows.map((r) => r.sherdog_url).slice(0, limit ?? undefined);
  console.log(`Sherdog: ${rows.length} unchecked URL(s), fetching ${urls.length}.`);

  let found = 0;
  let failed = 0;
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    let heightCm: number | null;
    try {
      heightCm = parseFighterHeightCm(await fetchAndLoad(url));
    } catch (error) {
      failed++; // left unchecked, so the next run retries it
      console.warn(`  failed to fetch ${url}: ${(error as Error).message}`);
      continue;
    }
    if (heightCm !== null) found++;
    await sql`
      UPDATE fighters SET height_cm = COALESCE(${heightCm}, height_cm), physique_sherdog_checked_at = NOW()
      WHERE sherdog_url = ${url}
    `;
    if ((i + 1) % 100 === 0) console.log(`  ...${i + 1}/${urls.length} (${found} with a height)`);
  }
  console.log(`Sherdog: done, ${found}/${urls.length} had a height, ${failed} failed.`);
}

async function syncFromUfcStats(limit: number | null) {
  const rows = (await sql`
    SELECT DISTINCT ufcstats_url FROM fighters
    WHERE ufcstats_url IS NOT NULL AND physique_ufcstats_checked_at IS NULL
  `) as { ufcstats_url: string }[];
  const urls = rows.map((r) => r.ufcstats_url).slice(0, limit ?? undefined);
  console.log(`UFCStats: ${rows.length} unchecked URL(s), fetching ${urls.length}.`);

  let withReach = 0;
  let failed = 0;
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    let physique;
    try {
      physique = parseFighterPhysique(await fetchAndLoadPW(url));
    } catch (error) {
      failed++;
      console.warn(`  failed to fetch ${url}: ${(error as Error).message}`);
      continue;
    }
    if (physique.reachCm !== null) withReach++;
    await sql`
      UPDATE fighters SET
        reach_cm = COALESCE(${physique.reachCm}, reach_cm),
        height_cm = COALESCE(height_cm, ${physique.heightCm}),
        physique_ufcstats_checked_at = NOW()
      WHERE ufcstats_url = ${url}
    `;
    if ((i + 1) % 100 === 0) console.log(`  ...${i + 1}/${urls.length} (${withReach} with a reach)`);
  }
  console.log(`UFCStats: done, ${withReach}/${urls.length} had a reach, ${failed} failed.`);
}

// ufcstats_url only ever lands on a fighter's UFC row; copy what it gave onto
// that same person's rows in other orgs (same sherdog_url), so their Bellator
// or PFL page shows the reach too.
async function propagateToSiblings() {
  const updated = (await sql`
    UPDATE fighters f SET
      reach_cm = COALESCE(f.reach_cm, s.reach_cm),
      height_cm = COALESCE(f.height_cm, s.height_cm)
    FROM fighters s
    WHERE s.sherdog_url = f.sherdog_url AND s.id <> f.id
      AND ((f.reach_cm IS NULL AND s.reach_cm IS NOT NULL) OR (f.height_cm IS NULL AND s.height_cm IS NOT NULL))
    RETURNING f.id
  `) as { id: number }[];
  console.log(`Copied height/reach onto ${updated.length} same-person row(s) in other orgs.`);
}

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.slice('--limit='.length), 10) : null;
  const source = args.find((a) => a.startsWith('--source='))?.slice('--source='.length);

  await ensureSchema();
  try {
    if (source !== 'ufcstats') await syncFromSherdog(limit);
    if (source !== 'sherdog') await syncFromUfcStats(limit);
  } finally {
    await closeBrowser(); // otherwise the tsx process never exits on its own
  }
  await propagateToSiblings();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
