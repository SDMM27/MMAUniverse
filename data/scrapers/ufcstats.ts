// data/scrapers/ufcstats.ts
import { fetchAndLoadPW } from './shared/fetch-playwright';
import { loadUfcStatsProgress, saveUfcStatsProgress } from './shared/ufcstats-checkpoint';
import { parseCompletedEventUrls, parseEventMeta, parseEventFightUrls, parseFightDetails } from './parse-ufcstats';
import type { UfcStatsFighterSide } from './parse-ufcstats';
import type { UfcStatsFightRecord } from './shared/ufcstats-types';

const EVENTS_LIST_URL = 'http://ufcstats.com/statistics/events/completed?page=all';

function toRecord(
  side: UfcStatsFighterSide,
  opponent: UfcStatsFighterSide,
  event: { name: string; date: string },
  meta: { weightClass: string; isTitleFight: boolean; method: string; round: number; time: string; scheduledRounds: number },
  fightUrl: string,
): UfcStatsFightRecord {
  return {
    fighter_name: side.name,
    fighter_ufcstats_url: side.ufcstatsUrl,
    opponent_name: opponent.name,
    opponent_ufcstats_url: opponent.ufcstatsUrl,
    event_name: event.name,
    event_date: event.date,
    ufcstats_fight_url: fightUrl,
    result: side.result,
    weight_class: meta.weightClass,
    is_title_fight: meta.isTitleFight,
    method: meta.method,
    round: meta.round,
    time: meta.time,
    scheduled_rounds: meta.scheduledRounds,
    totals: side.totals,
    strikes: side.strikes,
    rounds: side.rounds,
  };
}

/**
 * Scrapes every completed UFC event's fight-level stats off UFCStats.com:
 * discovers every event URL from the "completed" listing, then for each not
 * already in the checkpoint, fetches every fight on it and records both
 * fighters' totals + strike breakdown as one row each. Saves the checkpoint
 * after every event, so a crash mid-run loses at most one event's worth of
 * fetches (~10-15 fight-page requests at 1.5s each).
 *
 * `maxNewEvents`, when given, stops after scraping that many *not-yet-
 * processed* events — for a smoke-test run scoped to a handful of events
 * rather than the full multi-hour history.
 */
export async function scrapeUfcStats(cacheDir: string, maxNewEvents?: number): Promise<UfcStatsFightRecord[]> {
  const progress = loadUfcStatsProgress(cacheDir);
  const processedEvents = new Set(progress.processedEventUrls);

  const $list = await fetchAndLoadPW(EVENTS_LIST_URL);
  const eventUrls = parseCompletedEventUrls($list);

  let newlyProcessed = 0;
  for (const eventUrl of eventUrls) {
    if (processedEvents.has(eventUrl)) continue;
    if (maxNewEvents !== undefined && newlyProcessed >= maxNewEvents) break;

    const $event = await fetchAndLoadPW(eventUrl);
    const meta = parseEventMeta($event);
    const fightUrls = parseEventFightUrls($event);

    for (const fightUrl of fightUrls) {
      const $fight = await fetchAndLoadPW(fightUrl);
      const { fighters, meta: fightMeta } = parseFightDetails($fight);
      const [a, b] = fighters;
      // A fight page that failed to resolve either fighter's name (e.g. a
      // cancelled/no-stats bout UFCStats still lists) is skipped rather than
      // pushing half-empty records.
      if (!a.name || !b.name) continue;
      progress.records.push(toRecord(a, b, meta, fightMeta, fightUrl));
      progress.records.push(toRecord(b, a, meta, fightMeta, fightUrl));
    }

    progress.processedEventUrls.push(eventUrl);
    saveUfcStatsProgress(cacheDir, progress);
    newlyProcessed++;
  }

  return progress.records;
}
