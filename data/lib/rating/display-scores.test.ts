// data/lib/rating/display-scores.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { capChallengersBelowChampion, homeDivision, isEligibleInDivision, divisionDisplayScores, poundForPoundScores, CHALLENGER_SCORE_CAP } from './display-scores';

test('isEligibleInDivision: recent bout in the fighter\'s latest division', () => {
  assert.equal(isEligibleInDivision({ lastFightDateInDivision: '2026-01-01', isChampion: false, isHomeDivision: true }, '2026-09-22'), true);
});

test('homeDivision: the official ranking division wins over a one-off bout elsewhere', () => {
  const state = { lastDivision: 'Welterweight', lastFightDateByDivision: new Map([['Lightweight', '2026-03-07'], ['Welterweight', '2026-07-11']]) };
  assert.equal(homeDivision(state, 'Lightweight', '2026-09-22'), 'Lightweight');
  assert.equal(homeDivision(state, undefined, '2026-09-22'), 'Welterweight');
  assert.equal(homeDivision(state, 'Featherweight', '2026-09-22'), 'Welterweight'); // never fought there
});

test('homeDivision: an official division they stopped competing in falls back to the latest one', () => {
  const state = { lastDivision: "Women's Flyweight", lastFightDateByDivision: new Map([["Women's Strawweight", '2025-02-08'], ["Women's Flyweight", '2025-11-15']]) };
  assert.equal(homeDivision(state, "Women's Strawweight", '2026-09-23'), "Women's Flyweight"); // last strawweight bout is over 18 months old
  assert.equal(homeDivision(state, "Women's Strawweight", '2026-06-01'), "Women's Strawweight");
});

test('isEligibleInDivision: a fighter who has since moved up is out of the old division\'s list, even if recent', () => {
  assert.equal(isEligibleInDivision({ lastFightDateInDivision: '2026-01-01', isChampion: false, isHomeDivision: false }, '2026-09-22'), false);
});

test('isEligibleInDivision: inactive for more than 18 months in the division is out, unless champion', () => {
  assert.equal(isEligibleInDivision({ lastFightDateInDivision: '2024-01-01', isChampion: false, isHomeDivision: true }, '2026-09-22'), false);
  assert.equal(isEligibleInDivision({ lastFightDateInDivision: '2024-01-01', isChampion: true, isHomeDivision: false }, '2026-09-22'), true);
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

test('capChallengersBelowChampion: challengers rated above their champion drop just below them, in order', () => {
  const scores = new Map([[1, 40], [2, 55], [3, 50], [4, 70]]); // 1 = champion, 2 and 3 = same division, 4 = elsewhere
  const capped = capChallengersBelowChampion(scores, [{ championId: 1, eligibleIds: [1, 2, 3] }]);
  assert.equal(capped.get(1), 40); // the champion keeps their own score
  assert.ok(Math.abs(capped.get(2)! - 39.9) < 1e-9);
  assert.ok(Math.abs(capped.get(3)! - 39.8) < 1e-9);
  assert.equal(capped.get(4), 70);
  assert.equal(scores.get(2), 55); // input untouched
});

test('capChallengersBelowChampion: leaves a division whose champion is already on top, or has none', () => {
  assert.deepEqual(capChallengersBelowChampion(new Map([[1, 80], [2, 60]]), [{ championId: 1, eligibleIds: [1, 2] }]), new Map([[1, 80], [2, 60]]));
  assert.deepEqual(capChallengersBelowChampion(new Map([[2, 60]]), [{ championId: undefined, eligibleIds: [2] }]), new Map([[2, 60]]));
});
