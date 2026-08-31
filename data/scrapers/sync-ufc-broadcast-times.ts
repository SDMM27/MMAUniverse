// data/scrapers/sync-ufc-broadcast-times.ts
//
// UFC-only for now: Sherdog (our main data source) rarely has a real kickoff time for an event —
// its `startDate` meta tag defaults to midnight UTC on the date when Sherdog itself doesn't know
// the real time yet (see formatEventTime's placeholder filtering in data/lib/event-utils.ts).
// ufc.com, on the other hand, publishes the real broadcast schedule — Prelims and Main Card each
// with their own timezone-correct time — so this scrapes that directly and writes it into two
// UFC-only columns, `prelims_start` / `main_card_start`, distinct from the coarser `start_time`.
//
// No listing-page scraping, no pagination: ufc.com event slugs are predictable enough to build
// straight from data we already have in `events` (see buildUfcEventUrl below). When ufc.com
// hasn't published a given event's page yet, the guessed URL 404s or redirects to its search
// page — both land on a page with no viewing-option markup, which parseUfcCardTimes reports as
// "not found" rather than throwing, so this script just skips that event until tomorrow's run.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import { neon } from '@neondatabase/serverless';

// tsx doesn't auto-load .env.local the way Next.js does; same hand-rolled loader as
// sync-upcoming-to-db.ts.
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

const UFC_ORGANIZATION_ID = 1;
const USER_AGENT = 'MMA-Universe-DataScraper/1.0 (research/hobby project; contact: donsacha27@gmail.com)';
const UFC_NUMBERED_EVENT_RE = /^UFC (\d+)\b/;
const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

/**
 * Builds the predicted ufc.com event page URL from data we already have.
 * - A numbered event ("UFC 332 - TBA") -> /event/ufc-{number}. A sponsor-prefixed canonical
 *   slug (e.g. "cryptocom-ufc-331") is reached via a 301 that a plain fetch follows transparently.
 * - Anything else (Fight Nights, "UFC Qatar - TBA", etc.) -> the date-based Fight Night slug,
 *   which is what ufc.com actually uses for those regardless of the matchup name.
 */
export function buildUfcEventUrl(event: { name: string; date: string }): string {
  const numbered = UFC_NUMBERED_EVENT_RE.exec(event.name);
  if (numbered) {
    return `https://www.ufc.com/event/ufc-${numbered[1]}`;
  }
  const [year, month, day] = event.date.split('-');
  const monthName = MONTH_NAMES[Number(month) - 1];
  return `https://www.ufc.com/event/ufc-fight-night-${monthName}-${day}-${year}`;
}

/**
 * Parses ufc.com's "How to Watch" widget out of an event page's HTML. Reads by position, not by
 * label text — labels are French ("Combats préliminaires", "Carte principale") or English
 * depending on the requester's apparent locale, but the `data-timestamp` values are always in
 * broadcast order: earliest tier (2-tier Prelims/Main or 3-tier Early Prelims/Prelims/Main)
 * first, Main Card last. The widget is duplicated verbatim elsewhere on the page, hence the
 * dedup. Returns nulls (not a throw) when the page has no such widget at all — a 404 or a
 * redirect to ufc.com's search page both land here, meaning "not published yet".
 */
export function parseUfcCardTimes(html: string): { prelimsStart: string | null; mainCardStart: string | null } {
  const $ = cheerio.load(html);
  const timestamps: number[] = [];
  $('.c-listing-viewing-option__time[data-timestamp]').each((_, el) => {
    const raw = $(el).attr('data-timestamp');
    const value = raw ? Number(raw) : NaN;
    if (Number.isFinite(value) && !timestamps.includes(value)) {
      timestamps.push(value);
    }
  });

  if (timestamps.length === 0) {
    return { prelimsStart: null, mainCardStart: null };
  }
  return {
    prelimsStart: new Date(timestamps[0] * 1000).toISOString(),
    mainCardStart: new Date(timestamps[timestamps.length - 1] * 1000).toISOString(),
  };
}

async function main() {
  loadEnvLocal();
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set (expected in .env.local, or the environment in CI)');
    process.exit(1);
  }
  const sql = neon(process.env.DATABASE_URL);

  const events = (await sql`
    SELECT id, name, date FROM events
    WHERE organization_id = ${UFC_ORGANIZATION_ID} AND date::date >= CURRENT_DATE
    ORDER BY date ASC
  `) as { id: number; name: string; date: string }[];

  console.log(`Checking ${events.length} upcoming UFC event(s) for ufc.com broadcast times...`);

  for (const event of events) {
    const url = buildUfcEventUrl(event);
    let html: string;
    try {
      const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
      html = await response.text();
    } catch (error) {
      console.warn(`  "${event.name}" -> fetch failed (${(error as Error).message}), skipping`);
      continue;
    }

    const { prelimsStart, mainCardStart } = parseUfcCardTimes(html);
    if (!mainCardStart) {
      console.log(`  "${event.name}" -> not published on ufc.com yet (${url})`);
      continue;
    }

    await sql`
      UPDATE events SET prelims_start = ${prelimsStart}, main_card_start = ${mainCardStart}
      WHERE id = ${event.id}
    `;
    console.log(`  "${event.name}" -> prelims ${prelimsStart}, main card ${mainCardStart}`);
  }

  console.log('Done.');
}

// Guarded so importing the pure functions above (buildUfcEventUrl, parseUfcCardTimes) from
// sync-ufc-broadcast-times.test.ts doesn't also kick off a real DB connection + network scrape —
// package.json's "type": "module" means there's no CJS `require.main === module` to lean on.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
