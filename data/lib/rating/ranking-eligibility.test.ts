// data/lib/rating/ranking-eligibility.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isRankingEligible } from './ranking-eligibility';

const TODAY = '2026-09-17';

test('a fighter who competed within the last 18 months is ranked', () => {
  assert.equal(isRankingEligible({ lastFightDate: '2025-10-25', isChampion: false }, TODAY), true);
  assert.equal(isRankingEligible({ lastFightDate: '2025-04-01', isChampion: false }, TODAY), true);
});

test('a fighter inactive for more than 18 months drops out of the ranking', () => {
  assert.equal(isRankingEligible({ lastFightDate: '2024-07-27', isChampion: false }, TODAY), false);
  assert.equal(isRankingEligible({ lastFightDate: '2021-07-10', isChampion: false }, TODAY), false);
});

test('the reigning champion stays ranked however long they have been out', () => {
  assert.equal(isRankingEligible({ lastFightDate: '2024-07-27', isChampion: true }, TODAY), true);
});

test('a fighter with no dated fight is not ranked', () => {
  assert.equal(isRankingEligible({ lastFightDate: null, isChampion: false }, TODAY), false);
});
