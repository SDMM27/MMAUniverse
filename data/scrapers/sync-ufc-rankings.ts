// data/scrapers/sync-ufc-rankings.ts
//
// Scrapes UFC.com's own official "Meta UFC Rankings" page into the generic
// `rankings` table (see app/seed/route.ts's seedRankings). Other organizations
// have no equivalent official source yet -- schema and UI already support any
// organization_id, this scraper only ever writes organization_id = 1 (UFC).
//
// Two quirks of ufc.com discovered while building this:
//
// 1. Locale is geo-IP-based, not Accept-Language-based -- a plain fetch from a
//    non-US IP silently returns French division labels ("Poids mouche" instead
//    of "Flyweight") no matter what Accept-Language header is sent. ufc.com
//    does expose a language-switch endpoint that sets a region cookie forcing
//    English while leaving geo-based region detection alone; fetchEnglishHtml
//    below does that two-step dance (switch, then fetch with the cookie it set).
// 2. The rankings page renders the SAME set of weight-class tables twice in the
//    raw HTML (a "Meta UFC Rankings" tab and a duplicate "Media Panel Rankings"
//    tab, both present in the DOM, just CSS-toggled) -- parseUfcRankings dedupes
//    by each table's caption <h4> text and keeps only the first-seen occurrence,
//    rather than relying on brittle tabpanel selectors.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import { neon } from '@neondatabase/serverless';
import { matchFighterByName } from './ranking-name-match';

// tsx doesn't auto-load .env.local the way Next.js does; same hand-rolled loader as
// sync-ufc-broadcast-times.ts / sync-upcoming-to-db.ts.
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
const RANKINGS_URL = 'https://www.ufc.com/rankings';
const LANGUAGE_SWITCH_URL = 'https://www.ufc.com/language/switch/en';

export type ParsedRanking = {
  weightClass: string;
  rank: number; // 0 = champion
  fighterName: string;
};

/**
 * Fetches ufc.com/rankings with English division labels regardless of this
 * machine's own geo-IP locale -- see file header point 1. Falls back to
 * whatever locale a plain fetch would have gotten if the language-switch
 * request itself fails, rather than erroring the whole sync over it.
 */
async function fetchEnglishRankingsHtml(): Promise<string> {
  let cookie = '';
  try {
    // redirect: 'manual' is required here -- /language/switch/en itself 302s
    // (back to /rankings), and fetch()'s default of following that redirect
    // makes a second request whose own Set-Cookie response (geo-IP-default,
    // e.g. French) clobbers the English one this endpoint just set. Reading
    // getSetCookie() off this first, unfollowed response avoids that; plain
    // headers.get('set-cookie') also isn't reliable for multiple cookies.
    const switchResponse = await fetch(LANGUAGE_SWITCH_URL, {
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'manual',
    });
    cookie = switchResponse.headers.getSetCookie().join('; ');
  } catch (error) {
    console.warn(`Language-switch request failed (${(error as Error).message}), falling back to default locale.`);
  }

  const response = await fetch(RANKINGS_URL, {
    headers: { 'User-Agent': USER_AGENT, ...(cookie ? { Cookie: cookie } : {}) },
  });
  return response.text();
}

/**
 * Parses every weight-class table out of ufc.com/rankings. Dedupes by caption
 * text (first-seen wins -- see file header point 2) since the Meta and Media
 * Panel tabs duplicate every table. The table list itself is discovered
 * dynamically, not hardcoded -- the exact set of divisions (and whether a
 * Pound-for-Pound table is present) has changed over time on ufc.com's end.
 */
export function parseUfcRankings(html: string): ParsedRanking[] {
  const $ = cheerio.load(html);
  const seenWeightClasses = new Set<string>();
  const results: ParsedRanking[] = [];

  $('table').each((_, table) => {
    const $table = $(table);
    const weightClass = $table.find('caption h4').first().text().replace(/\s+/g, ' ').trim();
    if (!weightClass || seenWeightClasses.has(weightClass)) return; // dedupe / skip malformed tables
    seenWeightClasses.add(weightClass);

    const championName = $table.find('caption h5 a').first().text().trim();

    const contenders: ParsedRanking[] = [];
    $table.find('tbody tr').each((_, row) => {
      const $row = $(row);
      // The rank cell's class has been seen both as `views-field-weight-class-rank`
      // and `views-field-meta-weight-class-rank` across requests -- match by suffix
      // so either variant works, while still excluding the `-rank-change` column.
      const rankText = $row.find('td[class$="weight-class-rank"]').first().text().trim();
      const fighterName = $row.find('td.views-field-title a').first().text().trim();
      const rank = Number(rankText);
      // Number('') is 0, which is finite -- an explicit non-empty check keeps a
      // blank cell from being silently mistaken for a rank-0 (champion) row.
      if (rankText !== '' && Number.isFinite(rank) && fighterName) {
        contenders.push({ weightClass, rank, fighterName });
      }
    });

    // Pound-for-Pound tables have no actual titleholder -- ufc.com still
    // renders the #1-ranked fighter in the caption (the same "champion"
    // markup real divisions use), which would otherwise show up in our UI as
    // a redundant "C" row on top of an identical "#1" row for the same
    // person. Only keep the caption as a distinct champion (rank 0) entry
    // when it's someone other than the #1 contender already in the list.
    if (championName && contenders[0]?.fighterName !== championName) {
      results.push({ weightClass, rank: 0, fighterName: championName });
    }
    results.push(...contenders);
  });

  return results;
}

async function main() {
  loadEnvLocal();
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set (expected in .env.local, or the environment in CI)');
    process.exit(1);
  }
  const sql = neon(process.env.DATABASE_URL);

  console.log(`Fetching ${RANKINGS_URL}...`);
  const html = await fetchEnglishRankingsHtml();
  const parsed = parseUfcRankings(html);

  if (parsed.length === 0) {
    console.error('Parsed zero rankings rows -- treating as a scrape failure, leaving existing data untouched.');
    process.exit(1);
  }

  const ufcFighters = (await sql`
    SELECT id, name FROM fighters WHERE organization_id = ${UFC_ORGANIZATION_ID}
  `) as { id: number; name: string }[];

  const rows = parsed.map((row) => {
    const match = matchFighterByName(row.fighterName, ufcFighters);
    if (!match) console.log(`  No fighter match for "${row.fighterName}" (${row.weightClass})`);
    return { ...row, fighterId: match?.id ?? null };
  });

  await sql`DELETE FROM rankings WHERE organization_id = ${UFC_ORGANIZATION_ID}`;
  for (const row of rows) {
    await sql`
      INSERT INTO rankings (organization_id, weight_class, rank, fighter_name, fighter_id)
      VALUES (${UFC_ORGANIZATION_ID}, ${row.weightClass}, ${row.rank}, ${row.fighterName}, ${row.fighterId})
    `;
  }

  console.log(`Synced ${rows.length} ranking rows across ${new Set(parsed.map((r) => r.weightClass)).size} divisions.`);
}

// Guarded so importing the pure functions above from sync-ufc-rankings.test.ts
// doesn't also kick off a real DB connection + network scrape -- package.json's
// "type": "module" means there's no CJS `require.main === module` to lean on.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
