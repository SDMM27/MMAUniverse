// data/scrapers/backfill-fighter-history.ts
//
// One-off backfill: parseFighterDetails/parseFighterFightHistory were added after most
// fighters were already scraped, so their data/scraped/{org}.json entries predate
// `sherdog_url`/`fight_history` and the normal scrape path won't refetch them — both
// run-all.ts and rescrape-upcoming.ts skip a fighter page once its name is already known
// (see the checkpoint in shared/checkpoint.ts and the knownFighterNames guard in
// rescrape-upcoming.ts). This script re-fetches each already-known fighter's own Sherdog
// page once, purely to fill in those two new fields, and writes the result back in place.
//
// Recovers each fighter's Sherdog URL from data/scraped/.cache/{org}-progress.json's
// `fighterUrlToName` map (the same one run-all.ts builds while walking event cards) — orgs
// with no cache file (pfl, bellator: scraped before checkpointing existed) can't be targeted
// this way; re-run `npm run scrape:<org>` for those instead (an empty checkpoint means a
// normal run already re-crawls everything, fight_history included).
//
// A fighter appearing in multiple orgs is only fetched once: this builds one global
// sherdogUrl -> name map across every org first, then applies each result to every matching
// (by name) entry across every data/scraped/*.json file.
//
// Usage: npx tsx data/scrapers/backfill-fighter-history.ts [orgKey ...]
import fs from 'node:fs';
import path from 'node:path';
import { fetchAndLoad } from './shared/fetch-throttled';
import { parseFighterDetails, toScrapedFightHistory } from './parse';
import { ORG_CONFIGS } from './orgs.config';
import type { ScrapedOrgData } from './shared/types';

const SCRAPED_DIR = path.resolve('data/scraped');
const CACHE_DIR = path.resolve('data/scraped/.cache');
const BACKFILL_PROGRESS_FILE = path.join(CACHE_DIR, 'fighter-history-backfill-progress.json');

interface BackfillResult {
  sherdogUrl: string;
  imageUrl: string;
  weightClass: string;
  record: string;
  fightHistory: ReturnType<typeof toScrapedFightHistory>;
}

function loadBackfillProgress(): Record<string, BackfillResult> {
  if (!fs.existsSync(BACKFILL_PROGRESS_FILE)) return {};
  return JSON.parse(fs.readFileSync(BACKFILL_PROGRESS_FILE, 'utf-8'));
}

function saveBackfillProgress(progress: Record<string, BackfillResult>): void {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(BACKFILL_PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

function loadDataset(orgKey: string): ScrapedOrgData | null {
  const file = path.join(SCRAPED_DIR, `${orgKey}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function loadFighterUrlToName(orgKey: string): Record<string, string> {
  const file = path.join(CACHE_DIR, `${orgKey}-progress.json`);
  if (!fs.existsSync(file)) return {};
  const progress = JSON.parse(fs.readFileSync(file, 'utf-8'));
  return progress.fighterUrlToName ?? {};
}

async function main() {
  const requestedKeys = process.argv.slice(2);
  const configs = requestedKeys.length > 0 ? ORG_CONFIGS.filter((c) => requestedKeys.includes(c.orgKey)) : ORG_CONFIGS;

  // One global map so a fighter shared across orgs (e.g. a champion who fought in both KSW
  // and UFC) is only fetched once.
  const urlToName = new Map<string, string>();
  const orgsWithoutCache: string[] = [];
  for (const config of configs) {
    const mapping = loadFighterUrlToName(config.orgKey);
    if (Object.keys(mapping).length === 0) {
      orgsWithoutCache.push(config.orgKey);
      continue;
    }
    for (const [url, name] of Object.entries(mapping)) {
      urlToName.set(url, name);
    }
  }

  if (orgsWithoutCache.length > 0) {
    console.log(
      `No progress cache for: ${orgsWithoutCache.join(', ')} — can't recover fighter URLs for them here. Re-run "npm run scrape:<org>" for each instead (empty checkpoint = full re-crawl, which picks up fight_history automatically).`,
    );
  }

  const progress = loadBackfillProgress();
  const urls = Array.from(urlToName.keys());
  const alreadyDone = urls.filter((u) => progress[u]).length;
  console.log(`${urls.length} unique fighter URL(s) to backfill, ${alreadyDone} already done in a previous run.`);

  let fetched = 0;
  for (const url of urls) {
    if (progress[url]) continue;
    try {
      const $fighter = await fetchAndLoad(url);
      const details = parseFighterDetails($fighter);
      progress[url] = {
        sherdogUrl: url,
        imageUrl: details.imageUrl,
        weightClass: details.weightClass,
        record: `${details.wins}-${details.losses}-${details.draws}`,
        fightHistory: toScrapedFightHistory(details.fightHistory),
      };
      fetched++;
      if (fetched % 25 === 0) {
        saveBackfillProgress(progress);
        console.log(`  ...${fetched} fetched this run (${Object.keys(progress).length}/${urls.length} total)`);
      }
    } catch (error) {
      console.warn(`  failed to fetch ${url}: ${(error as Error).message}`);
    }
  }
  saveBackfillProgress(progress);
  console.log(`Done fetching. ${Object.keys(progress).length}/${urls.length} fighter pages have data.`);

  // Apply results back onto every org's dataset, matched by name (the same natural key the
  // rest of the sync/seed scripts already rely on).
  for (const config of configs) {
    const dataset = loadDataset(config.orgKey);
    if (!dataset) continue;

    const nameToResult = new Map<string, BackfillResult>();
    for (const [url, name] of Object.entries(loadFighterUrlToName(config.orgKey))) {
      const result = progress[url];
      if (result) nameToResult.set(name, result);
    }
    if (nameToResult.size === 0) continue;

    let updated = 0;
    for (const fighter of dataset.fighters) {
      const result = nameToResult.get(fighter.name);
      if (!result) continue;
      fighter.sherdog_url = result.sherdogUrl;
      fighter.fight_history = result.fightHistory;
      updated++;
    }

    const outFile = path.join(SCRAPED_DIR, `${config.orgKey}.json`);
    fs.writeFileSync(outFile, JSON.stringify(dataset, null, 2));
    console.log(`[${config.orgKey}] backfilled fight_history for ${updated}/${dataset.fighters.length} fighters -> ${outFile}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
