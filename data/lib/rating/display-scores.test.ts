// data/lib/rating/display-scores.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isEligibleInDivision, divisionDisplayScores, poundForPoundScores, CHALLENGER_SCORE_CAP } from './display-scores';

test('isEligibleInDivision: recent bout in the fighter\'s latest division', () => {
  assert.equal(isEligibleInDivision({ lastFightDateInDivision: '2026-01-01', isChampion: false, isLatestDivision: true }, '2026-09-22'), true);
});

test('isEligibleInDivision: a fighter who has since moved up is out of the old division\'s list, even if recent', () => {
  assert.equal(isEligibleInDivision({ lastFightDateInDivision: '2026-01-01', isChampion: false, isLatestDivision: false }, '2026-09-22'), false);
});

test('isEligibleInDivision: inactive for more than 18 months in the division is out, unless champion', () => {
  assert.equal(isEligibleInDivision({ lastFightDateInDivision: '2024-01-01', isChampion: false, isLatestDivision: true }, '2026-09-22'), false);
  assert.equal(isEligibleInDivision({ lastFightDateInDivision: '2024-01-01', isChampion: true, isLatestDivision: false }, '2026-09-22'), true);
});

test('divisionDisplayScores: the champion is 100 even when outrated, challengers are capped below and keep their order', () => {
  const scores = divisionDisplayScores([
    { fighterId: 1, conservative: 1700, isChampion: true, eligible: true },
    { fighterId: 2, conservative: 1900, isChampion: false, eligible: true },
    { fighterId: 3, conservative: 1850, isChampion: false, eligible: true },
    { fighterId: 4, conservative: 1500, isChampion: false, eligible: true },
  ]);
  assert.equal(scores.get(1), 100);
  assert.equal(scores.get(2), CHALLENGER_SCORE_CAP);
  assert.ok(scores.get(3)! < CHALLENGER_SCORE_CAP && scores.get(3)! > scores.get(4)!);
});

test('divisionDisplayScores: without a champion, the best eligible fighter is 100', () => {
  const scores = divisionDisplayScores([
    { fighterId: 1, conservative: 1800, isChampion: false, eligible: true },
    { fighterId: 2, conservative: 1600, isChampion: false, eligible: true },
  ]);
  assert.equal(scores.get(1), 100);
  assert.ok(scores.get(2)! > 47 && scores.get(2)! < 49);
});

test('divisionDisplayScores: the reference is the best ELIGIBLE fighter; an inactive one above it is capped, not 100', () => {
  const scores = divisionDisplayScores([
    { fighterId: 1, conservative: 1800, isChampion: false, eligible: true },
    { fighterId: 2, conservative: 2000, isChampion: false, eligible: false },
  ]);
  assert.equal(scores.get(1), 100);
  assert.equal(scores.get(2), CHALLENGER_SCORE_CAP);
});

test('poundForPoundScores: one common scale, no champion rule -- the best is 100, a weaker champion is not', () => {
  const scores = poundForPoundScores([
    { fighterId: 1, conservative: 1900, eligible: true },
    { fighterId: 2, conservative: 1700, eligible: true },
    { fighterId: 3, conservative: 2100, eligible: false },
  ]);
  assert.equal(scores.get(1), 100);
  assert.ok(scores.get(2)! < 50);
  assert.equal(scores.get(3), 100); // capped, and kept out of the P4P list by eligibility anyway
});
