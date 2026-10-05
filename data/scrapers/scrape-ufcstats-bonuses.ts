// data/scrapers/scrape-ufcstats-bonuses.ts
//
// CLI entry point: records which UFC fights earned a Fight / Performance of the
// Night bonus (icons on each UFCStats event page, see parseEventBonuses) into
// data/scraped/ufcstats-bonuses.json, for FightScore's dominance score. Kept
// apart from scrape-ufcstats.ts because that one skips events it already has
// and bonuses were added after most of them were scraped -- the first run walks
// every event page (one fetch each, no fight pages), later runs only the events
// not yet seen plus those from the last REFETCH_DAYS days (bonuses are
// announced after the card, and UFCStats fills them in late). Resumable: the
// file is rewritten after every event. Run with `npm run scrape:ufcstats-bonuses`;
// `sync-fighter-stats` pushes it into Neon. Pass `--limit=N` to stop after N events.
import fs from 'node:fs';
import { fetchAndLoadPW, closeBrowser } from './shared/fetch-playwright';
import { parseCompletedEvents, parseEventBonuses, parseEventMeta } from './parse-ufcstats';
import { loadUfcStatsBonuses, UFCSTATS_BONUSES_FILE } from './shared/ufcstats-bonuses';

const EVENTS_LIST_URL = 'http://ufcstats.com/statistics/events/completed?page=all';
const OUTPUT_FILE = UFCSTATS_BONUSES_FILE;
const REFETCH_DAYS = 60;

async function main() {
  const limitArg = process.argv.slice(2).find((a) => a.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.slice('--limit='.length)) : undefined;
  const data = loadUfcStatsBonuses();
  const cutoff = new Date(Date.now() - REFETCH_DAYS * 86_400_000).toISOString().slice(0, 10);

  try {
    const events = parseCompletedEvents(await fetchAndLoadPW(EVENTS_LIST_URL));
    let fetched = 0;
    for (const { url } of events) {
      const knownDate = data.events[url];
      if (knownDate !== undefined && knownDate !== '' && knownDate < cutoff) continue;
      if (limit !== undefined && fetched >= limit) break;

      const $event = await fetchAndLoadPW(url);
      data.events[url] = parseEventMeta($event).date;
      for (const [fightUrl, bonuses] of Array.from(parseEventBonuses($event))) data.fights[fightUrl] = bonuses;
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data));
      fetched++;
      if (fetched % 25 === 0) console.log(`  ${fetched} event page(s) fetched...`);
    }
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 1));
    console.log(`Done. ${fetched} event page(s) fetched; ${Object.keys(data.fights).length} fight(s) with a bonus across ${Object.keys(data.events).length} event(s).`);
  } finally {
    await closeBrowser();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
