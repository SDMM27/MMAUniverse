import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectExternalBouts, prospectInitialRating, prospectInitialRatings, simulateProspectElo, PROSPECT_ELO_BASE, type ExternalHistoryRow } from './prospect-rating';

const row = (owner: string, opponent: string, date: string, result: string, eventName = 'LFA 100'): ExternalHistoryRow => ({ owner, opponent, eventName, date, result });

test('collectExternalBouts keeps each decided non-UFC bout once, oldest first', () => {
  const bouts = collectExternalBouts([
    row('a', 'b', '2020-02-01', 'win'),
    row('b', 'a', '2020-02-01', 'loss'), // same bout from b's history
    row('a', 'c', '2019-01-01', 'loss'),
    row('a', 'd', '2021-01-01', 'win', 'UFC Fight Night 200'),
    row('a', 'e', '2021-02-01', 'win', 'UFC - The Ultimate Fighter 28 Finale'),
    row('a', 'f', '2021-03-01', 'draw'),
    { owner: 'a', opponent: null, eventName: 'X', date: '2021-04-01', result: 'win' },
  ]);
  assert.deepEqual(bouts, [
    { date: '2019-01-01', winner: 'c', loser: 'a' },
    { date: '2020-02-01', winner: 'a', loser: 'b' },
  ]);
});

test('simulateProspectElo is point in time and rewards beating strong opponents', () => {
  const lookup = simulateProspectElo([
    { date: '2020-01-01', winner: 'strong', loser: 'x' },
    { date: '2020-02-01', winner: 'strong', loser: 'y' },
    { date: '2020-03-01', winner: 'a', loser: 'strong' },
    { date: '2020-03-01', winner: 'b', loser: 'nobody' },
  ]);
  assert.equal(lookup('a', '2020-03-01').bouts, 0); // the same day's bout isn't "before"
  assert.equal(lookup('a', '2020-03-01').rating, PROSPECT_ELO_BASE);
  const a = lookup('a', '2020-03-02');
  const b = lookup('b', '2020-03-02');
  assert.equal(a.bouts, 1);
  assert.ok(a.rating > b.rating, `${a.rating} > ${b.rating}`);
  assert.equal(lookup('unknown', '2030-01-01').rating, PROSPECT_ELO_BASE);
});

test('prospectInitialRating leaves a fighter without known bouts at initialRating', () => {
  assert.equal(prospectInitialRating({ rating: PROSPECT_ELO_BASE, bouts: 0 }, 0.8, 1500), 1500);
  assert.equal(prospectInitialRating({ rating: 1600, bouts: 5 }, 0.5, 1500), 1550);
});

test('prospectInitialRatings starts a debutant from their Sherdog record, others at initialRating', () => {
  const rows = [row('pro', 'x', '2019-01-01', 'win'), row('pro', 'y', '2019-06-01', 'win')];
  const initialRatingOf = prospectInitialRatings(rows, new Map([[1, 'pro'], [2, 'nobody'], [4, 'pro']]), 1500, { k: 32, scale: 1, unknown: 'base' });
  assert.ok(initialRatingOf(1, '2020-01-01') > 1500);
  assert.equal(initialRatingOf(4, '2018-01-01'), 1500); // same record, debut before any of its bouts
  assert.equal(initialRatingOf(2, '2020-01-01'), 1500);
  assert.equal(initialRatingOf(3, '2020-01-01'), 1500); // no Sherdog URL
});

test("unknown 'average' starts unknown debutants at the known debutants' running average, memoized", () => {
  const rows = [row('pro', 'x', '2019-01-01', 'win'), row('pro', 'y', '2019-06-01', 'win')];
  const initialRatingOf = prospectInitialRatings(rows, new Map([[1, 'pro']]), 1500, { k: 32, scale: 1, unknown: 'average' });
  assert.equal(initialRatingOf(9, '2018-01-01'), 1500); // no known debutant yet
  const pro = initialRatingOf(1, '2020-01-01');
  assert.equal(initialRatingOf(2, '2020-02-01'), pro); // the average of one
  assert.equal(initialRatingOf(9, '2030-01-01'), 1500); // asked again: same answer
});
