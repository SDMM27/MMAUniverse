// data/scrapers/backfill-fighter-nationality.ts
//
// One-off: fixes the 3-letter-flag-code gap left by the never-merged
// feat/fighter-nationality-scraping branch. That branch's own one-off backfill
// (see git history: 207d782, d864823, 726eabd — never merged to main) already
// populated `fighters.nationality` for most of the roster directly against
// production, using a regex that only ever matched a 2-letter flag filename
// (`/\/([a-z]{2})\.png$/`). Sherdog keys most countries that way (br.png,
// fr.png, ...) and even keys the UK's constituent countries that way —
// England is "en.png", Wales "wa.png", Northern Ireland "nb.png", all present
// in the DB today (see components/ui/shared/country-flag.tsx for how the UI
// maps those three non-ISO codes to real flags). Scotland is the one
// exception: its flag file is "sct.png" — three letters — so every Scottish
// fighter silently got `nationality: null` instead of being skipped loudly.
// Confirmed live before this script ran: 0 of 8753 fighters tagged Scottish.
//
// This script re-fetches just the fighters that came back `nationality: null`
// with a known `sherdog_url` (the ones that branch's own regex could have
// gotten wrong) and writes the result straight to the database — no
// data/scraped/*.json round-trip, since main never had the pipeline code
// that reads nationality out of that JSON in the first place (also part of
// that unmerged branch). Scotland's code is stored as the 2-letter "SC" (not
// the real 3-letter "SCT") so it still fits the existing
// `nationality VARCHAR(2)` column without a migration.
//
// Safe to re-run: only ever targets rows still sitting at `nationality IS
// NULL`, and writes are idempotent per fighter id. Progress is checkpointed
// to data/scraped/.cache/fighter-nationality-gaps-progress.json (keyed by
// sherdog_url, since one real person's URL can be shared by several
// same-person rows across different orgs — fetched once, applied to all of
// them) so an interrupted run picks back up instead of re-fetching.
//
// Usage: npx tsx data/scrapers/backfill-fighter-nationality.ts
import fs from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';
import type { CheerioAPI } from 'cheerio';
import { fetchAndLoad } from './shared/fetch-throttled';

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

const CACHE_DIR = path.resolve('data/scraped/.cache');
const PROGRESS_FILE = path.join(CACHE_DIR, 'fighter-nationality-gaps-progress.json');

interface ProgressEntry {
  nationality: string | null;
}

function loadProgress(): Record<string, ProgressEntry> {
  if (!fs.existsSync(PROGRESS_FILE)) return {};
  return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
}

function saveProgress(progress: Record<string, ProgressEntry>): void {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// Same source Sherdog field the unmerged branch used
// (`.fighter-nationality img.big_flag`'s `src`), but accepting the 2-OR-3-letter
// filename instead of just 2. Scotland ("sct") is normalized to the 2-letter "SC"
// so it fits the existing column; any other unexpected 3-letter code is logged
// and skipped rather than guessed at.
function parseNationalityFromFlag($: CheerioAPI): string | null {
  const flagSrc = $('.fighter-nationality img.big_flag').first().attr('src');
  if (!flagSrc) return null;
  const match = flagSrc.match(/\/([a-z]{2,3})\.png$/i);
  if (!match) return null;
  const code = match[1].toLowerCase();
  if (code.length === 2) return code.toUpperCase();
  if (code === 'sct') return 'SC';
  console.warn(`  unrecognized 3-letter flag code "${code}" (${flagSrc}) — skipped, not stored`);
  return null;
}

async function main() {
  // --limit=N caps how many *unique URLs* get fetched this run — a quick way to smoke-test
  // against a handful of real fighters before committing to the full ~45-minute run.
  const limitArg = process.argv.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.slice('--limit='.length), 10) : null;

  const candidates = (await sql`
    SELECT id, sherdog_url FROM fighters WHERE nationality IS NULL AND sherdog_url IS NOT NULL
  `) as { id: number; sherdog_url: string }[];

  console.log(`${candidates.length} fighter row(s) with no nationality and a known sherdog_url.`);

  // Dedupe by URL: the same real person can have one row per org they've fought in.
  const rowsByUrl = new Map<string, number[]>();
  for (const row of candidates) {
    const ids = rowsByUrl.get(row.sherdog_url) ?? [];
    ids.push(row.id);
    rowsByUrl.set(row.sherdog_url, ids);
  }
  console.log(`${rowsByUrl.size} unique sherdog_url(s) to fetch.`);

  const progress = loadProgress();
  let urls = Array.from(rowsByUrl.keys());
  const alreadyDone = urls.filter((u) => progress[u]).length;
  console.log(`${alreadyDone} already fetched in a previous run.`);
  if (limit !== null) {
    urls = urls.filter((u) => !progress[u]).slice(0, limit);
    console.log(`--limit=${limit}: only fetching ${urls.length} not-yet-done url(s) this run.`);
  }

  let fetched = 0;
  let foundCount = 0;
  let scottishCount = 0;
  let rowsUpdated = 0;

  for (const url of urls) {
    if (!progress[url]) {
      try {
        const $fighter = await fetchAndLoad(url);
        const nationality = parseNationalityFromFlag($fighter);
        progress[url] = { nationality };
        fetched++;
        if (fetched % 25 === 0) {
          saveProgress(progress);
          console.log(`  ...${fetched} fetched this run (${Object.keys(progress).length}/${urls.length} total)`);
        }
      } catch (error) {
        console.warn(`  failed to fetch ${url}: ${(error as Error).message}`);
        continue;
      }
    }

    const result = progress[url];
    if (!result || result.nationality === null) continue;
    foundCount++;
    if (result.nationality === 'SC') scottishCount++;

    for (const fighterId of rowsByUrl.get(url) ?? []) {
      await sql`UPDATE fighters SET nationality = ${result.nationality} WHERE id = ${fighterId} AND nationality IS NULL`;
      rowsUpdated++;
    }
  }

  saveProgress(progress);
  console.log(
    `Done. ${fetched} page(s) fetched this run, ${foundCount}/${urls.length} URL(s) had a usable flag ` +
      `(${scottishCount} Scottish), ${rowsUpdated} fighter row(s) updated.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
