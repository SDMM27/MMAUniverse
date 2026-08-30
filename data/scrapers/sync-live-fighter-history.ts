// data/scrapers/sync-live-fighter-history.ts
//
// Event-day companion to rescrape-upcoming.ts: that script keeps the `fights`/`events` tables
// current (so the homepage and a fighter's "Prochain combat" reflect tonight's result right
// away), but a fighter's own "Historique" list comes from `fighter_fight_history` — scraped off
// the fighter's *own* Sherdog page (see sync-fighter-history.ts) — which nothing refreshes on a
// live day. backfill-fighter-history.ts could in principle re-fetch that page, but it's a
// one-off tool: it checkpoints every fighter URL it has ever fetched and skips it forever after,
// so wiring it into a recurring cron would never actually pick up a fighter's newest fight.
//
// This script instead always re-fetches (no checkpoint) — but only for the small set of
// fighters who actually fought in one of *today's* events for the given org(s), keeping Sherdog
// traffic minimal the same way rescrape-upcoming.ts does for the card itself. Run it after
// rescrape-upcoming.ts (so today's event is already in the JSON) and before sync-fighter-history.ts
// (which pushes the refreshed fight_history into Neon).
//
// Usage: npx tsx data/scrapers/sync-live-fighter-history.ts <orgKey> [orgKey ...] [--date=YYYY-MM-DD]
// --date defaults to today (UTC) — the recurring workflow never needs it; it's there so a manual
// catch-up run can target a specific already-happened event day (e.g. the workflow run was
// skipped, or this script didn't exist yet for a card that already happened).
import fs from 'node:fs';
import path from 'node:path';
import { fetchAndLoad } from './shared/fetch-throttled';
import { parseFighterDetails, toScrapedFightHistory } from './parse';
import { ORG_CONFIGS } from './orgs.config';
import type { ScrapedOrgData } from './shared/types';

const SCRAPED_DIR = path.resolve('data/scraped');

function loadDataset(orgKey: string): ScrapedOrgData | null {
  const file = path.join(SCRAPED_DIR, `${orgKey}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

async function main() {
  const rawArgs = process.argv.slice(2);
  const dateArg = rawArgs.find((a) => a.startsWith('--date='));
  const requestedKeys = rawArgs.filter((a) => !a.startsWith('--date='));
  if (requestedKeys.length === 0) {
    console.error('Usage: npx tsx data/scrapers/sync-live-fighter-history.ts <orgKey> [orgKey ...] [--date=YYYY-MM-DD]');
    process.exit(1);
  }
  const configs = ORG_CONFIGS.filter((c) => requestedKeys.includes(c.orgKey));

  const today = dateArg ? dateArg.slice('--date='.length) : new Date().toISOString().slice(0, 10);

  for (const config of configs) {
    const dataset = loadDataset(config.orgKey);
    if (!dataset) {
      console.warn(`[${config.orgKey}] no data/scraped/${config.orgKey}.json — skipping`);
      continue;
    }

    const todaysEventNames = new Set(dataset.events.filter((e) => e.date === today).map((e) => e.name));
    if (todaysEventNames.size === 0) {
      console.log(`[${config.orgKey}] no event dated ${today} in the dataset — nothing to refresh`);
      continue;
    }

    const fighterNamesTonight = new Set<string>();
    for (const fight of dataset.fights) {
      if (!todaysEventNames.has(fight.event_name)) continue;
      fighterNamesTonight.add(fight.fighter1_name);
      fighterNamesTonight.add(fight.fighter2_name);
    }

    let refreshed = 0;
    let skippedNoUrl = 0;
    for (const fighter of dataset.fighters) {
      if (!fighterNamesTonight.has(fighter.name)) continue;
      if (!fighter.sherdog_url) {
        // Brand-new fighter never backfilled — the regular backfill/sync scripts own
        // picking this up; nothing to refresh yet.
        skippedNoUrl++;
        continue;
      }
      try {
        const $fighter = await fetchAndLoad(fighter.sherdog_url);
        const details = parseFighterDetails($fighter);
        fighter.fight_history = toScrapedFightHistory(details.fightHistory);
        refreshed++;
      } catch (error) {
        console.warn(`  failed to refresh ${fighter.name} (${fighter.sherdog_url}): ${(error as Error).message}`);
      }
    }

    if (refreshed > 0) {
      const outFile = path.join(SCRAPED_DIR, `${config.orgKey}.json`);
      fs.writeFileSync(outFile, JSON.stringify(dataset, null, 2));
    }
    console.log(
      `[${config.orgKey}] refreshed fight_history for ${refreshed}/${fighterNamesTonight.size} fighter(s) on tonight's card` +
        (skippedNoUrl > 0 ? ` (${skippedNoUrl} skipped: no sherdog_url yet)` : ''),
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
