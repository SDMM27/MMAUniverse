// data/scrapers/parse.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import { parseEventTableUrls, parseOlderEventsUrl, parseEventDetails, parseFighterDetails } from './parse';

// package.json has "type": "module", so this file runs as native ESM under
// tsx --test — __dirname isn't defined there, unlike the plan's CJS-style snippet.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, '__fixtures__');
const BASE_URL = 'https://www.sherdog.com';

function loadFixture(name: string): cheerio.CheerioAPI {
  return cheerio.load(fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf-8'));
}

test('parseEventTableUrls extracts event URLs from the upcoming tab', () => {
  const $ = loadFixture('org-page.html');
  const urls = parseEventTableUrls($, 'upcoming_tab', BASE_URL);

  assert.deepEqual(urls, [
    'https://www.sherdog.com/events/Professional-Fighters-League-PFL-Tampa-Cyborg-vs-Vieira-113435',
    'https://www.sherdog.com/events/Professional-Fighters-League-PFL-MENA-11-2026-Semifinals-113638',
  ]);
});

test('parseEventTableUrls extracts event URLs from the recent tab', () => {
  const $ = loadFixture('org-page.html');
  const urls = parseEventTableUrls($, 'recent_tab', BASE_URL);

  assert.deepEqual(urls, [
    'https://www.sherdog.com/events/Professional-Fighters-League-PFL-Charlotte-Battle-vs-Rosta-113347',
    'https://www.sherdog.com/events/Professional-Fighters-League-2021-Season-PFL-Championships-90187',
  ]);
});

test('parseOlderEventsUrl finds the "Older Events" pagination link', () => {
  const $ = loadFixture('org-page.html');
  const url = parseOlderEventsUrl($, BASE_URL);

  assert.equal(url, 'https://www.sherdog.com/organizations/Professional-Fighters-League-12241/recent-events/2');
});

test('parseOlderEventsUrl returns null on the last page', () => {
  const $ = loadFixture('org-page-last.html');
  const url = parseOlderEventsUrl($, BASE_URL);

  assert.equal(url, null);
});

test('parseEventDetails extracts event metadata and all fights from a finished event', () => {
  const $ = loadFixture('event-page-finished.html');
  const details = parseEventDetails($, BASE_URL);

  assert.equal(details.name, 'Bellator MMA - Bellator 100');
  assert.equal(details.date, '2013-09-20');
  assert.equal(details.start_time, '2013-09-20T00:00:00+00:00');
  assert.equal(details.location, 'Grand Canyon University Arena, Phoenix, Arizona, United States');
  assert.equal(details.poster, 'https://www1-cdn.sherdog.com/image_vs/233453');
  assert.equal(details.fights.length, 2);

  const mainEvent = details.fights[0];
  assert.equal(mainEvent.weight_class, 'Welterweight');
  assert.equal(mainEvent.fighter1.name, 'Douglas Lima');
  assert.equal(mainEvent.fighter1.sherdogUrl, 'https://www.sherdog.com/fighter/Douglas-Lima-17236');
  assert.equal(mainEvent.fighter1.result, 'win');
  assert.equal(mainEvent.fighter2.name, 'Ben Saunders');
  assert.equal(mainEvent.fighter2.result, 'loss');
  assert.equal(mainEvent.method, 'KO (Head Kick)');
  assert.equal(mainEvent.round, 2);
  assert.equal(mainEvent.time, '4:33');
  assert.equal(mainEvent.is_main_event, true);

  const undercardFight = details.fights[1];
  assert.equal(undercardFight.weight_class, 'Welterweight');
  assert.equal(undercardFight.fighter1.name, 'War Machine');
  assert.equal(undercardFight.fighter1.result, 'win');
  assert.equal(undercardFight.fighter2.name, 'Vaughn Anderson');
  assert.equal(undercardFight.fighter2.result, 'loss');
  assert.equal(undercardFight.method, 'Technical Submission (Rear-Naked Choke)');
  assert.equal(undercardFight.round, 2);
  assert.equal(undercardFight.time, '4:01');
  assert.equal(undercardFight.is_main_event, false);
});

test('parseEventDetails marks fights as not finished on an upcoming event', () => {
  const $ = loadFixture('event-page-upcoming.html');
  const details = parseEventDetails($, BASE_URL);

  assert.equal(details.name, 'Professional Fighters League - PFL Tampa: Cyborg vs. Vieira');
  assert.equal(details.date, '2026-08-22');
  assert.equal(details.fights.length, 2);

  const mainEvent = details.fights[0];
  assert.equal(mainEvent.fighter1.result, 'not_finished');
  assert.equal(mainEvent.fighter2.result, 'not_finished');
  assert.equal(mainEvent.is_main_event, true);

  const undercardFight = details.fights[1];
  assert.equal(undercardFight.fighter1.name, 'Gadzhi Rabadanov');
  assert.equal(undercardFight.fighter1.result, 'not_finished');
  assert.equal(undercardFight.fighter2.result, 'not_finished');
  assert.equal(undercardFight.method, '');
  assert.equal(undercardFight.is_main_event, false);
});

test('parseFighterDetails extracts name, weight class, image and win/loss counts', () => {
  const $ = loadFixture('fighter-page.html');
  const details = parseFighterDetails($);

  assert.equal(details.name, 'Douglas Lima');
  assert.equal(details.weightClass, 'Middleweight');
  assert.equal(details.imageUrl, 'https://www.sherdog.com/image_crop/200/300/_images/fighter/20220401032612_Douglas_Lima_ff.JPG');
  assert.equal(details.wins, 33);
  assert.equal(details.losses, 12);
  assert.equal(details.draws, 0);
});
