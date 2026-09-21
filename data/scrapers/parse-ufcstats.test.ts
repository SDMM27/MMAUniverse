// data/scrapers/parse-ufcstats.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import { parseEventMeta, parseCompletedEventUrls, parseEventFightUrls, parseFightDetails, parseFightMeta } from './parse-ufcstats';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, '__fixtures__');

function loadFixture(name: string): cheerio.CheerioAPI {
  return cheerio.load(fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf-8'));
}

test('parseCompletedEventUrls extracts every event URL from the completed-events listing, skipping the linkless placeholder row', () => {
  const $ = loadFixture('ufcstats-events-completed.html');
  const urls = parseCompletedEventUrls($);

  assert.equal(urls.length, 3);
  assert.ok(urls.every((u) => u.startsWith('http://ufcstats.com/event-details/')));
  assert.ok(urls.includes('http://ufcstats.com/event-details/2144954270be834d'));
});

test('parseEventMeta extracts the event name, ISO date and location', () => {
  const $ = loadFixture('ufcstats-event-details.html');
  const meta = parseEventMeta($);

  assert.equal(meta.name, 'UFC 330: Makhachev vs. Machado Garry');
  assert.equal(meta.date, '2026-08-15');
  assert.equal(meta.location, 'Philadelphia, Pennsylvania, USA');
});

test('parseEventFightUrls extracts every fight-details URL from an event page', () => {
  const $ = loadFixture('ufcstats-event-details.html');
  const urls = parseEventFightUrls($);

  assert.ok(urls.length > 0);
  assert.ok(urls.every((u) => u.startsWith('http://ufcstats.com/fight-details/')));
  assert.ok(urls.includes('http://ufcstats.com/fight-details/365fd759c03e93cf'));
});

test('parseFightDetails extracts both fighters\' totals and strike breakdown for a decision', () => {
  const $ = loadFixture('ufcstats-fight-details-decision.html');
  const fight = parseFightDetails($);

  const [winner, loser] = fight.fighters;
  assert.equal(winner.name, 'Islam Makhachev');
  assert.equal(winner.result, 'win');
  assert.equal(loser.name, 'Ian Machado Garry');
  assert.equal(loser.result, 'loss');

  assert.deepEqual(winner.totals, {
    knockdowns: 1,
    sigStrikes: { landed: 22, attempted: 44 },
    totalStrikes: { landed: 78, attempted: 114 },
    takedowns: { landed: 7, attempted: 15 },
    submissionAttempts: 0,
    reversals: 0,
    controlTimeSeconds: 750, // 12:30
  });
  assert.deepEqual(loser.totals.takedowns, { landed: 0, attempted: 0 });
  assert.equal(loser.totals.controlTimeSeconds, 34); // 0:34

  assert.deepEqual(winner.strikes, {
    head: { landed: 9, attempted: 31 },
    body: { landed: 3, attempted: 3 },
    leg: { landed: 10, attempted: 10 },
    distance: { landed: 15, attempted: 36 },
    clinch: { landed: 6, attempted: 7 },
    ground: { landed: 1, attempted: 1 },
  });
});

test('parseFightDetails handles a finish (no control-time dashes are misread as 0)', () => {
  const $ = loadFixture('ufcstats-fight-details-finish.html');
  const fight = parseFightDetails($);

  assert.ok(fight.fighters.every((f) => f.name.length > 0));
  assert.ok(fight.fighters.some((f) => f.result === 'win'));
  assert.ok(fight.fighters.some((f) => f.result === 'loss'));
});

test('parseFightMeta extracts weight class, method, round, time and scheduled rounds for a title-fight decision', () => {
  const $ = loadFixture('ufcstats-fight-details-decision.html');
  const meta = parseFightMeta($);

  // Real fixture text: fight-title is "UFC Welterweight Title Bout" -- the
  // "UFC " prefix and "Title" both stripped, leaving just the division.
  assert.equal(meta.weightClass, 'Welterweight');
  assert.equal(meta.isTitleFight, true);
  assert.equal(meta.method, 'Decision - Unanimous');
  assert.equal(meta.round, 5);
  assert.equal(meta.time, '5:00');
  assert.equal(meta.scheduledRounds, 5);
});

test('parseFightMeta extracts weight class, method, round, time and scheduled rounds for a non-title finish', () => {
  const $ = loadFixture('ufcstats-fight-details-finish.html');
  const meta = parseFightMeta($);

  // Real fixture text: fight-title is "Lightweight Bout" -- no "UFC " prefix,
  // no "Title", on an ordinary (non-championship) bout.
  assert.equal(meta.weightClass, 'Lightweight');
  assert.equal(meta.isTitleFight, false);
  assert.equal(meta.method, 'KO/TKO');
  assert.equal(meta.round, 1);
  assert.equal(meta.time, '0:39');
  assert.equal(meta.scheduledRounds, 3);
});

test('parseFightDetails returns one round-by-round totals entry per round fought, in round order, for a 5-round decision', () => {
  const $ = loadFixture('ufcstats-fight-details-decision.html');
  const fight = parseFightDetails($);
  const [winner, loser] = fight.fighters;

  assert.equal(winner.rounds.length, 5);
  assert.deepEqual(
    winner.rounds.map((r) => r.round),
    [1, 2, 3, 4, 5],
  );

  // Round 1 numbers for Islam Makhachev, straight off the fixture's first
  // per-round row.
  assert.deepEqual(winner.rounds[0], {
    round: 1,
    knockdowns: 0,
    sigStrikes: { landed: 3, attempted: 5 },
    totalStrikes: { landed: 23, attempted: 25 },
    takedowns: { landed: 1, attempted: 5 },
    submissionAttempts: 0,
    reversals: 0,
    controlTimeSeconds: 218, // 3:38
  });

  // Per-round control time for both fighters sums to the fight-level total
  // already asserted above (750s / 34s) -- cross-checks the round parsing
  // against the totals parsing rather than trusting either in isolation.
  const winnerRoundControlSum = winner.rounds.reduce((sum, r) => sum + (r.controlTimeSeconds ?? 0), 0);
  const loserRoundControlSum = loser.rounds.reduce((sum, r) => sum + (r.controlTimeSeconds ?? 0), 0);
  assert.equal(winnerRoundControlSum, 750);
  assert.equal(loserRoundControlSum, 34);
});

test('parseFightDetails returns a single round-by-round entry for a round-1 finish', () => {
  const $ = loadFixture('ufcstats-fight-details-finish.html');
  const fight = parseFightDetails($);
  const [winner] = fight.fighters;

  assert.equal(winner.rounds.length, 1);
  assert.equal(winner.rounds[0].round, 1);
  assert.deepEqual(winner.rounds[0].sigStrikes, { landed: 9, attempted: 14 });
});
