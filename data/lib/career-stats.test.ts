// data/lib/career-stats.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeCareerStats, fightDurationSeconds, type UfcFightStatsRow } from './career-stats';

function row(overrides: Partial<UfcFightStatsRow> = {}): UfcFightStatsRow {
  return {
    finishRound: 3,
    finishTime: '5:00',
    knockdowns: 0,
    sigStrikesLanded: 0,
    sigStrikesAttempted: 0,
    takedownsLanded: 0,
    takedownsAttempted: 0,
    submissionAttempts: 0,
    controlTimeSeconds: null,
    headLanded: 0,
    bodyLanded: 0,
    legLanded: 0,
    opponent: null,
    ...overrides,
  };
}

test('fightDurationSeconds counts earlier rounds as 5 minutes', () => {
  assert.equal(fightDurationSeconds(3, '2:57'), 600 + 177);
  assert.equal(fightDurationSeconds(3, '5:00'), 900);
  assert.equal(fightDurationSeconds(1, '0:15'), 15);
});

test('fightDurationSeconds returns null for missing or malformed data', () => {
  assert.equal(fightDurationSeconds(null, '1:00'), null);
  assert.equal(fightDurationSeconds(2, null), null);
  assert.equal(fightDurationSeconds(2, 'abc'), null);
  assert.equal(fightDurationSeconds(0, '1:00'), null);
});

test('computeCareerStats returns null with no usable fight', () => {
  assert.equal(computeCareerStats([]), null);
  assert.equal(computeCareerStats([row({ finishRound: null })]), null);
});

test('computeCareerStats computes UFCStats-style rates', () => {
  // 10 minutes + 5 minutes = 15 minutes total.
  const stats = computeCareerStats([
    row({ finishRound: 2, finishTime: '5:00', sigStrikesLanded: 50, sigStrikesAttempted: 100, takedownsLanded: 1, takedownsAttempted: 4, submissionAttempts: 1, knockdowns: 1 }),
    row({ finishRound: 1, finishTime: '5:00', sigStrikesLanded: 10, sigStrikesAttempted: 20, takedownsLanded: 2, takedownsAttempted: 2, submissionAttempts: 2, knockdowns: 1 }),
  ])!;
  assert.equal(stats.fights, 2);
  assert.equal(stats.totalMinutes, 15);
  assert.equal(stats.knockdowns, 2);
  assert.equal(stats.sigStrikesLandedPerMinute, 4);
  assert.equal(stats.sigStrikeAccuracy, 0.5);
  assert.equal(stats.takedownsPer15, 3);
  assert.equal(stats.takedownAccuracy, 0.5);
  assert.equal(stats.submissionAttemptsPer15, 3);
});

test('computeCareerStats avoids dividing by zero attempts', () => {
  const stats = computeCareerStats([row()])!;
  assert.equal(stats.sigStrikeAccuracy, null);
  assert.equal(stats.takedownAccuracy, null);
  assert.equal(stats.strikeDistribution, null);
  assert.equal(stats.sigStrikesLandedPerMinute, 0);
});

test('computeCareerStats averages control time only over fights that report it', () => {
  const stats = computeCareerStats([
    row({ controlTimeSeconds: 300 }),
    row({ controlTimeSeconds: null }),
    row({ controlTimeSeconds: 100 }),
  ])!;
  assert.equal(stats.averageControlSeconds, 200);
  assert.equal(stats.controlShare, 400 / 1800);
  assert.equal(computeCareerStats([row()])!.averageControlSeconds, null);
  assert.equal(computeCareerStats([row()])!.controlShare, null);
});

test('computeCareerStats derives absorbed strikes and takedown defense from fights with an opponent row only', () => {
  const stats = computeCareerStats([
    row({ finishRound: 1, finishTime: '5:00', opponent: { sigStrikesLanded: 20, takedownsLanded: 1, takedownsAttempted: 4 } }),
    row({ finishRound: 1, finishTime: '5:00', sigStrikesLanded: 99 }),
  ])!;
  assert.equal(stats.sigStrikesAbsorbedPerMinute, 4);
  assert.equal(stats.takedownDefense, 0.75);
  const none = computeCareerStats([row()])!;
  assert.equal(none.sigStrikesAbsorbedPerMinute, null);
  assert.equal(none.takedownDefense, null);
});

test('computeCareerStats splits landed strikes by target', () => {
  const stats = computeCareerStats([row({ headLanded: 6, bodyLanded: 3, legLanded: 1 })])!;
  assert.deepEqual(stats.strikeDistribution, { head: 0.6, body: 0.3, leg: 0.1 });
});
