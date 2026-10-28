// data/scrapers/sync-fighter-physique.ts
//
// Fills fighters.height_cm / reach_cm / birth_date, shown in the header of the
// fighter page (web + mobile; birth_date as an age). Source: Sherdog --
// height and birth date (it has no reach field), every org, one fetch per
// unique sherdog_url, applied to every same-person row sharing it.
// Reach used to come from UFCStats (UFC fighters only); that source was
// removed on 2026-10-28 because fetching it meant bypassing its anti-bot
// challenge. Reach values already in the table stay; new fighters get none.
//
// Every row is stamped physique_*_checked_at once its page was read, found
// or not, so each page is fetched once ever (birth date came later: Sherdog
// pages read before it existed are fetched once more, via
// birth_date_sherdog_checked_at): the first run is a ~2h backfill
// (resumable -- stop it and re-run, it picks up where it was), every later
// run (daily-sync.yml) only touches fighters that got a URL since.
//
// Usage: npx tsx data/scrapers/sync-fighter-physique.ts [--limit=N]
import fs from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';
import { fetchAndLoad } from './shared/fetch-throttled';
import { parseFighterHeightCm, parseFighterBirthDate } from './parse';

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
  await sql`ALTER TABLE fighters ADD COLUMN IF NOT EXISTS birth_date DATE;`;
  await sql`ALTER TABLE fighters ADD COLUMN IF NOT EXISTS birth_date_sherdog_checked_at TIMESTAMPTZ;`;
}

async function syncFromSherdog(limit: number | null) {
  const rows = (await sql`
    SELECT DISTINCT sherdog_url FROM fighters
    WHERE sherdog_url IS NOT NULL
      AND (physique_sherdog_checked_at IS NULL OR birth_date_sherdog_checked_at IS NULL)
  `) as { sherdog_url: string }[];
  const urls = rows.map((r) => r.sherdog_url).slice(0, limit ?? undefined);
  console.log(`Sherdog: ${rows.length} unchecked URL(s), fetching ${urls.length}.`);

  let found = 0;
  let withBirthDate = 0;
  let failed = 0;
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    let heightCm: number | null;
    let birthDate: string | null;
    try {
      const $ = await fetchAndLoad(url);
      heightCm = parseFighterHeightCm($);
      birthDate = parseFighterBirthDate($);
    } catch (error) {
      failed++; // left unchecked, so the next run retries it
      console.warn(`  failed to fetch ${url}: ${(error as Error).message}`);
      continue;
    }
    if (heightCm !== null) found++;
    if (birthDate !== null) withBirthDate++;
    await sql`
      UPDATE fighters SET
        height_cm = COALESCE(${heightCm}, height_cm),
        birth_date = COALESCE(${birthDate}::date, birth_date),
        physique_sherdog_checked_at = NOW(),
        birth_date_sherdog_checked_at = NOW()
      WHERE sherdog_url = ${url}
    `;
    if ((i + 1) % 100 === 0) {
      console.log(`  ...${i + 1}/${urls.length} (${found} with a height, ${withBirthDate} with a birth date)`);
    }
  }
  console.log(`Sherdog: done, ${found}/${urls.length} had a height, ${withBirthDate} a birth date, ${failed} failed.`);
}

// Reach (from the former UFCStats source) only ever landed on a fighter's UFC
// row; copy it onto that same person's rows in other orgs (same sherdog_url),
// so their Bellator or PFL page shows it too.
async function propagateToSiblings() {
  const updated = (await sql`
    UPDATE fighters f SET
      reach_cm = COALESCE(f.reach_cm, s.reach_cm),
      height_cm = COALESCE(f.height_cm, s.height_cm),
      birth_date = COALESCE(f.birth_date, s.birth_date)
    FROM fighters s
    WHERE s.sherdog_url = f.sherdog_url AND s.id <> f.id
      AND ((f.reach_cm IS NULL AND s.reach_cm IS NOT NULL)
        OR (f.height_cm IS NULL AND s.height_cm IS NOT NULL)
        OR (f.birth_date IS NULL AND s.birth_date IS NOT NULL))
    RETURNING f.id
  `) as { id: number }[];
  console.log(`Copied height/reach/birth date onto ${updated.length} same-person row(s) in other orgs.`);
}

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.slice('--limit='.length), 10) : null;

  await ensureSchema();
  await syncFromSherdog(limit);
  await propagateToSiblings();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
