// data/scrapers/sherdog.ts
import { fetchAndLoad } from './shared/fetch-throttled';
import { loadProgress, saveProgress } from './shared/checkpoint';
import { parseEventTableUrls, parseOlderEventsUrl, parseEventDetails, parseFighterDetails, toScrapedFightHistory } from './parse';
import type { ScrapedOrgData, ScrapedFight } from './shared/types';

const SHERDOG_BASE = 'https://www.sherdog.com';

export interface OrgScrapeConfig {
  /** Short key used for checkpoint + output file naming: 'ufc' | 'pfl' | 'bellator'. */
  orgKey: string;
  organizationId: number;
  /** Path segment after the domain, e.g. 'organizations/Professional-Fighters-League-12241'. */
  sherdogOrgPath: string;
}

async function collectEventUrls(config: OrgScrapeConfig): Promise<string[]> {
  const orgUrl = `${SHERDOG_BASE}/${config.sherdogOrgPath}`;
  const urls = new Set<string>();

  const $first = await fetchAndLoad(orgUrl);
  parseEventTableUrls($first, 'upcoming_tab', SHERDOG_BASE).forEach((u) => urls.add(u));
  parseEventTableUrls($first, 'recent_tab', SHERDOG_BASE).forEach((u) => urls.add(u));

  let nextPageUrl = parseOlderEventsUrl($first, SHERDOG_BASE);
  while (nextPageUrl) {
    const $page = await fetchAndLoad(nextPageUrl);
    parseEventTableUrls($page, 'recent_tab', SHERDOG_BASE).forEach((u) => urls.add(u));
    nextPageUrl = parseOlderEventsUrl($page, SHERDOG_BASE);
  }

  return Array.from(urls);
}

/**
 * Scrapes one organization end-to-end: discovers every event URL (paginating
 * "Older Events" until exhausted), fetches each event not already in the
 * checkpoint, then fetches every fighter discovered along the way. Saves the
 * checkpoint after every event and every fighter, so a crash mid-run loses at
 * most the single in-flight request.
 */
export async function scrapeOrganization(config: OrgScrapeConfig, cacheDir: string): Promise<ScrapedOrgData> {
  const eventUrls = await collectEventUrls(config);
  const progress = loadProgress(config.orgKey, config.organizationId, cacheDir);
  const processedEvents = new Set(progress.processedEventUrls);
  const processedFighters = new Set(progress.processedFighterUrls);

  for (const eventUrl of eventUrls) {
    if (processedEvents.has(eventUrl)) continue;

    const $event = await fetchAndLoad(eventUrl);
    const details = parseEventDetails($event, SHERDOG_BASE);

    progress.data.events.push({
      name: details.name,
      date: details.date,
      start_time: details.start_time,
      event_location: details.location,
      event_poster: details.poster,
    });

    for (const fight of details.fights) {
      // sherdogUrl is '' when the fight row has no real fighter link (e.g. a
      // TBD opponent, or a stray non-http href `absoluteUrl` filtered out) —
      // skip those rather than queuing an unfetchable "fighter".
      if (fight.fighter1.sherdogUrl) progress.fighterUrlToName[fight.fighter1.sherdogUrl] = fight.fighter1.name;
      if (fight.fighter2.sherdogUrl) progress.fighterUrlToName[fight.fighter2.sherdogUrl] = fight.fighter2.name;

      const finished = fight.fighter1.result !== 'not_finished' || fight.fighter2.result !== 'not_finished';
      const winnerName =
        fight.fighter1.result === 'win' ? fight.fighter1.name : fight.fighter2.result === 'win' ? fight.fighter2.name : null;

      const scrapedFight: ScrapedFight = {
        event_name: details.name,
        fighter1_name: fight.fighter1.name,
        fighter2_name: fight.fighter2.name,
        fight_finished: finished,
        winner_name: winnerName,
        method: fight.method,
        round: fight.round,
        time: fight.time,
        weight_class: fight.weight_class,
        is_main_event: fight.is_main_event,
        is_title_fight: fight.is_title_fight,
      };
      progress.data.fights.push(scrapedFight);
    }

    progress.processedEventUrls.push(eventUrl);
    saveProgress(config.orgKey, progress, cacheDir);
  }

  for (const [fighterUrl, fallbackName] of Object.entries(progress.fighterUrlToName)) {
    if (processedFighters.has(fighterUrl)) continue;
    // Defensive guard against stale checkpoints saved before the fix above
    // (or any other non-http key that slips through): skip rather than crash.
    if (!fighterUrl.startsWith('http://') && !fighterUrl.startsWith('https://')) continue;

    const $fighter = await fetchAndLoad(fighterUrl);
    const details = parseFighterDetails($fighter);

    progress.data.fighters.push({
      name: details.name || fallbackName,
      image_url: details.imageUrl,
      weight_class: details.weightClass,
      record: `${details.wins}-${details.losses}-${details.draws}`,
      ranking: 0,
      sherdog_url: fighterUrl,
      fight_history: toScrapedFightHistory(details.fightHistory),
    });
    progress.processedFighterUrls.push(fighterUrl);
    saveProgress(config.orgKey, progress, cacheDir);
  }

  return progress.data;
}
