// data/scrapers/rescrape-upcoming.ts
//
// Targeted refresh: re-fetches only the "upcoming" events for each org (instead of the
// full multi-decade history via run-all.ts) and merges the result into the existing
// data/scraped/{org}.json, replacing whatever stale/partial data those events already had.
//
// Use this after a scraper/parser fix that only affects not-yet-fought events, so we don't
// have to re-walk the entire event history to see the fix take effect.
import fs from 'node:fs';
import path from 'node:path';
import { fetchAndLoad } from './shared/fetch-throttled';
import { parseEventTableUrls, parseEventDetails, parseFighterDetails } from './parse';
import { ORG_CONFIGS } from './orgs.config';
import type { ScrapedOrgData, ScrapedEvent, ScrapedFighter, ScrapedFight } from './shared/types';

const SHERDOG_BASE = 'https://www.sherdog.com';
const OUTPUT_DIR = path.resolve('data/scraped');

async function main() {
  const requestedKey = process.argv[2];
  const configs = requestedKey ? ORG_CONFIGS.filter((c) => c.orgKey === requestedKey) : ORG_CONFIGS;

  if (requestedKey && configs.length === 0) {
    console.error(`Unknown org key "${requestedKey}". Expected one of: ${ORG_CONFIGS.map((c) => c.orgKey).join(', ')}`);
    process.exit(1);
  }

  for (const config of configs) {
    const outFile = path.join(OUTPUT_DIR, `${config.orgKey}.json`);
    const existing: ScrapedOrgData = fs.existsSync(outFile)
      ? JSON.parse(fs.readFileSync(outFile, 'utf-8'))
      : { organization_id: config.organizationId, events: [], fighters: [], fights: [] };

    console.log(`[${config.orgKey}] fetching upcoming events list...`);
    const orgUrl = `${SHERDOG_BASE}/${config.sherdogOrgPath}`;
    const $org = await fetchAndLoad(orgUrl);
    const upcomingUrls = parseEventTableUrls($org, 'upcoming_tab', SHERDOG_BASE);
    console.log(`[${config.orgKey}] ${upcomingUrls.length} upcoming event(s) found`);

    const freshEvents: ScrapedEvent[] = [];
    const freshFights: ScrapedFight[] = [];
    const fighterUrlToName: Record<string, string> = {};

    for (const eventUrl of upcomingUrls) {
      const $event = await fetchAndLoad(eventUrl);
      const details = parseEventDetails($event, SHERDOG_BASE);

      freshEvents.push({
        name: details.name,
        date: details.date,
        start_time: details.start_time,
        event_location: details.location,
        event_poster: details.poster,
      });

      for (const fight of details.fights) {
        // sherdogUrl is '' when the fight row has no real fighter link (e.g. a
        // TBD opponent) — skip those rather than queuing an unfetchable "fighter"
        // (an empty URL resolves to http://localhost/ and fails the fetch below).
        // Mirrors the same guard already in sherdog.ts's scrapeOrganization.
        if (fight.fighter1.sherdogUrl) fighterUrlToName[fight.fighter1.sherdogUrl] = fight.fighter1.name;
        if (fight.fighter2.sherdogUrl) fighterUrlToName[fight.fighter2.sherdogUrl] = fight.fighter2.name;

        const finished = fight.fighter1.result !== 'not_finished' || fight.fighter2.result !== 'not_finished';
        const winnerName =
          fight.fighter1.result === 'win' ? fight.fighter1.name : fight.fighter2.result === 'win' ? fight.fighter2.name : null;

        freshFights.push({
          event_name: details.name,
          fighter1_name: fight.fighter1.name,
          fighter2_name: fight.fighter2.name,
          fight_finished: finished,
          winner_name: winnerName,
          method: fight.method,
          round: fight.round,
          time: fight.time,
          weight_class: fight.weight_class,
        });
      }
      console.log(`[${config.orgKey}] parsed "${details.name}" -> ${details.fights.length} fight(s)`);
    }

    // Only fetch fighter pages for names we don't already have data for.
    const knownFighterNames = new Set(existing.fighters.map((f) => f.name));
    const freshFighters: ScrapedFighter[] = [];
    for (const [fighterUrl, fallbackName] of Object.entries(fighterUrlToName)) {
      if (knownFighterNames.has(fallbackName)) continue;
      const $fighter = await fetchAndLoad(fighterUrl);
      const details = parseFighterDetails($fighter);
      freshFighters.push({
        name: details.name || fallbackName,
        image_url: details.imageUrl,
        weight_class: details.weightClass,
        record: `${details.wins}-${details.losses}-${details.draws}`,
        ranking: 0,
      });
    }

    // Match stale entries by date rather than name: Sherdog often renames an "upcoming" event
    // once the full card firms up (e.g. "UFC Fight Night - Sept. 26" -> "... Barcelos vs. Rosas
    // Jr."), so a name-based diff would leave the old placeholder as a duplicate alongside the
    // freshly-fetched one.
    const freshEventDates = new Set(freshEvents.map((e) => e.date));
    const staleEventNames = new Set(
      existing.events.filter((e) => freshEventDates.has(e.date)).map((e) => e.name),
    );
    const mergedEvents = [...existing.events.filter((e) => !staleEventNames.has(e.name)), ...freshEvents];
    const mergedFights = [...existing.fights.filter((f) => !staleEventNames.has(f.event_name)), ...freshFights];
    const mergedFighters = [...existing.fighters, ...freshFighters];

    const merged: ScrapedOrgData = {
      organization_id: config.organizationId,
      events: mergedEvents,
      fighters: mergedFighters,
      fights: mergedFights,
    };

    fs.writeFileSync(outFile, JSON.stringify(merged, null, 2));
    console.log(
      `[${config.orgKey}] wrote ${merged.events.length} events (${freshEvents.length} refreshed), ${merged.fighters.length} fighters (${freshFighters.length} new), ${merged.fights.length} fights to ${outFile}`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
