// data/scrapers/scrape-ufcstats.ts
//
// CLI entry point: scrapes every completed UFC event's fight-level stats off
// UFCStats.com (see ufcstats.ts) and writes the flat result to
// data/scraped/ufcstats-fight-stats.json. Resumable — re-running after a
// crash picks up from data/scraped/.cache/ufcstats-progress.json instead of
// starting over. Run with `npm run scrape:ufcstats`; push the output into
// Neon afterwards with `npm run sync:fighter-stats`. Pass `--limit=N` to stop
// after N not-yet-processed events (smoke-testing rather than a full run).
import fs from 'node:fs';
import path from 'node:path';
import { scrapeUfcStats } from './ufcstats';
import { closeBrowser } from './shared/fetch-playwright';

const CACHE_DIR = path.resolve('data/scraped/.cache');
const OUTPUT_FILE = path.resolve('data/scraped/ufcstats-fight-stats.json');

async function main() {
  const limitArg = process.argv.slice(2).find((a) => a.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.slice('--limit='.length)) : undefined;

  try {
    const records = await scrapeUfcStats(CACHE_DIR, limit);
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(records, null, 2));
    console.log(`Done. ${records.length} fight-stat row(s) written to ${OUTPUT_FILE}.`);
  } finally {
    // Always close the headless browser, even if a fetch threw partway
    // through — otherwise the tsx process never exits on its own.
    await closeBrowser();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
