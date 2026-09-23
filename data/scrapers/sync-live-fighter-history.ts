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
// Usage: npx tsx data/scrapers/sync-live-fighter-history.ts <orgKey> [orgKey ...] [--date=YYYY-MM-DD[,YYYY-MM-DD]]
// --date defaults to the live dates (today, plus yesterday until noon UTC so an American card
// running past midnight UTC isn't cut off — see shared/live-dates.ts); the recurring workflow
// never needs it, it's there so a manual run can target a specific already-happened event day.
//
// --catch-up (daily-sync.yml, no orgKey = every org): instead of today's card, looks at every
// *finished* fight from the last 30 days and re-fetches only the fighters whose Sherdog history
// still has no fight on that date — e.g. the event-day polling stopped before the main card, or
// Sherdog hadn't updated the fighter's page yet. Self-healing: once the fight is in the history
// the fighter is never fetched again, so a quiet day costs no Sherdog traffic at all.
import fs from 'node:fs';
import path from 'node:path';
import { fetchAndLoad } from './shared/fetch-throttled';
import { parseFighterDetails, toScrapedFightHistory } from './parse';
import { ORG_CONFIGS } from './orgs.config';
import { isRecentPastDate, liveEventDates } from './shared/live-dates';
import type { ScrapedOrgData } from './shared/types';

const SCRAPED_DIR = path.resolve('data/scraped');

function loadDataset(orgKey: string): ScrapedOrgData | null {
  const file = path.join(SCRAPED_DIR, `${orgKey}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

// Names of the fighters to re-fetch in `dataset`: everyone on the card on one of `dates`, or in
// catch-up mode, fighters with a recent finished fight missing from their own fight_history.
function fightersToRefresh(dataset: ScrapedOrgData, dates: string[] | null): Set<string> {
  const names = new Set<string>();
  if (dates) {
    const eventNames = new Set(dataset.events.filter((e) => dates.includes(e.date)).map((e) => e.name));
    for (const fight of dataset.fights) {
      if (!eventNames.has(fight.event_name)) continue;
      names.add(fight.fighter1_name);
      names.add(fight.fighter2_name);
    }
    return names;
  }

  const recentEventDates = new Map(dataset.events.filter((e) => isRecentPastDate(e.date)).map((e) => [e.name, e.date]));
  const historyDatesByName = new Map(
    dataset.fighters.map((f) => [f.name, new Set((f.fight_history ?? []).map((h) => h.date))]),
  );
  for (const fight of dataset.fights) {
    const date = recentEventDates.get(fight.event_name);
    if (!date || !fight.fight_finished) continue;
    for (const name of [fight.fighter1_name, fight.fighter2_name]) {
      if (!historyDatesByName.get(name)?.has(date)) names.add(name);
    }
  }
  return names;
}

async function main() {
  const rawArgs = process.argv.slice(2);
  const dateArg = rawArgs.find((a) => a.startsWith('--date='));
  const catchUp = rawArgs.includes('--catch-up');
  const requestedKeys = rawArgs.filter((a) => !a.startsWith('--'));
  if (requestedKeys.length === 0 && !catchUp) {
    console.error(
      'Usage: npx tsx data/scrapers/sync-live-fighter-history.ts <orgKey> [orgKey ...] [--date=YYYY-MM-DD[,YYYY-MM-DD]] | [orgKey ...] --catch-up',
    );
    process.exit(1);
  }
  const configs = requestedKeys.length > 0 ? ORG_CONFIGS.filter((c) => requestedKeys.includes(c.orgKey)) : ORG_CONFIGS;

  const dates = catchUp ? null : dateArg ? dateArg.slice('--date='.length).split(',') : liveEventDates();

  for (const config of configs) {
    const dataset = loadDataset(config.orgKey);
    if (!dataset) {
      console.warn(`[${config.orgKey}] no data/scraped/${config.orgKey}.json — skipping`);
      continue;
    }

    const fighterNamesTonight = fightersToRefresh(dataset, dates);
    if (fighterNamesTonight.size === 0) {
      console.log(`[${config.orgKey}] ${dates ? `no event dated ${dates.join(' / ')}` : 'no recent fight missing from a fighter history'} — nothing to refresh`);
      continue;
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
      `[${config.orgKey}] refreshed fight_history for ${refreshed}/${fighterNamesTonight.size} fighter(s) ${dates ? "on tonight's card" : 'missing a recent fight'}` +
        (skippedNoUrl > 0 ? ` (${skippedNoUrl} skipped: no sherdog_url yet)` : ''),
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
