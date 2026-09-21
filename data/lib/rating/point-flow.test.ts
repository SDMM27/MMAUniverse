// data/lib/rating/point-flow.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { erodePoints, applyPointFlow, HAND_PICKED_POINT_FLOW_PARAMS, type FighterPointState, type FightContext } from './point-flow';

// These tests pin the formula's mechanics against the hand-picked constants
// (12-month grace, 40% floor, ...) so they stay readable; the tuned defaults
// are exercised by point-flow-tuning's own checks.
const P = HAND_PICKED_POINT_FLOW_PARAMS;

function fighter(overrides: Partial<FighterPointState>): FighterPointState {
  return { points: 0.1, currentStreak: 0, isFormerChampion: false, monthsSinceLastFight: 0, ...overrides };
}

function context(overrides: Partial<FightContext>): FightContext {
  return { dominanceScore: 0.5, isTitleFight: false, isFiveRounds: false, divisionAveragePoints: 0.02, ...overrides };
}

test('erodePoints does not erode within the 12-month grace period', () => {
  assert.equal(erodePoints(0.5, 0, P), 0.5);
  assert.equal(erodePoints(0.5, 12, P), 0.5);
});

test('erodePoints decays beyond 12 months of inactivity', () => {
  const eroded = erodePoints(0.5, 18, P);
  assert.ok(eroded < 0.5, `expected decay, got ${eroded}`);
  assert.ok(eroded > 0.2, `expected to still be above the 40% floor, got ${eroded}`);
});

test('erodePoints never drops below 40% of the original value, however long the inactivity', () => {
  const eroded = erodePoints(0.5, 600, P); // 50 years inactive
  assert.ok(Math.abs(eroded - 0.5 * 0.4) < 1e-9, `expected the 40% floor, got ${eroded}`);
});

test('beating a much-higher-points opponent yields a much bigger gain than beating a much-lower-points opponent, dominance held equal', () => {
  const winner = fighter({ points: 0.05 });
  const strongOpponent = fighter({ points: 1.0 });
  const weakOpponent = fighter({ points: 0.01 });
  const ctx = context({ dominanceScore: 0.5 });

  const vsStrong = applyPointFlow(winner, strongOpponent, ctx, P);
  const vsWeak = applyPointFlow(winner, weakOpponent, ctx, P);

  const gainVsStrong = vsStrong.winnerPoints - winner.points;
  const gainVsWeak = vsWeak.winnerPoints - winner.points;
  assert.ok(gainVsStrong > gainVsWeak * 5, `expected a much bigger gain beating the strong opponent: ${gainVsStrong} vs ${gainVsWeak}`);
});

test('the floor rule keeps the winner strictly ahead of the loser even when the raw formula would not', () => {
  // A huge points gap, minimal dominance, and no activity credit (0 average)
  // -- the raw formula's gain alone would leave the winner well short of the
  // loser's points; the floor rule must still push them just past it.
  const winner = fighter({ points: 0.01 });
  const loser = fighter({ points: 5.0 });
  const ctx = context({ dominanceScore: 0, divisionAveragePoints: 0 });

  const result = applyPointFlow(winner, loser, ctx, P);
  // Raw gain here is 0.5 * 5.0 * 0.8 = 2.0 (winnerEroded 0.01 + gain = 2.01),
  // well short of the loser's pre-loss eroded points (5.0, no erosion at 0
  // months inactive) -- confirms the floor rule (not the raw formula) is
  // what actually produced winnerPoints, landing exactly at 5.0 + 0.01.
  // (result.loserPoints is lower still, since the loser also loses points in
  // this same fight -- the floor compares against the loser's *pre-loss*
  // eroded points, not the final post-loss figure.)
  assert.ok(Math.abs(result.winnerPoints - 5.01) < 1e-9, `expected exactly 5.01, got ${result.winnerPoints}`);
  assert.ok(result.winnerPoints > result.loserPoints, `expected winner (${result.winnerPoints}) > loser (${result.loserPoints})`);
});

test('a higher dominance score produces both a bigger winner gain and a bigger loser loss', () => {
  const winner = fighter({});
  const loser = fighter({});
  const lowDominance = applyPointFlow(winner, loser, context({ dominanceScore: 0.1 }), P);
  const highDominance = applyPointFlow(winner, loser, context({ dominanceScore: 0.9 }), P);

  const gainLow = lowDominance.winnerPoints - winner.points;
  const gainHigh = highDominance.winnerPoints - winner.points;
  assert.ok(gainHigh > gainLow, `expected bigger gain at higher dominance: ${gainHigh} vs ${gainLow}`);

  const lossLow = loser.points - lowDominance.loserPoints;
  const lossHigh = loser.points - highDominance.loserPoints;
  assert.ok(lossHigh > lossLow, `expected bigger loss at higher dominance: ${lossHigh} vs ${lossLow}`);
});

test('a title fight increases the winner gain and decreases the loser loss', () => {
  const winner = fighter({});
  const loser = fighter({});
  const nonTitle = applyPointFlow(winner, loser, context({ isTitleFight: false }), P);
  const title = applyPointFlow(winner, loser, context({ isTitleFight: true }), P);

  const gainNonTitle = nonTitle.winnerPoints - winner.points;
  const gainTitle = title.winnerPoints - winner.points;
  assert.ok(gainTitle > gainNonTitle, `expected a bigger gain in a title fight: ${gainTitle} vs ${gainNonTitle}`);

  const lossNonTitle = loser.points - nonTitle.loserPoints;
  const lossTitle = loser.points - title.loserPoints;
  assert.ok(lossTitle < lossNonTitle, `expected a smaller loss in a title fight: ${lossTitle} vs ${lossNonTitle}`);
});

test('a longer win streak produces a bigger gain than a 0-streak win, all else equal', () => {
  const loser = fighter({});
  const noStreak = applyPointFlow(fighter({ currentStreak: 0 }), loser, context({}), P);
  const longStreak = applyPointFlow(fighter({ currentStreak: 8 }), loser, context({}), P);

  const gainNoStreak = noStreak.winnerPoints - 0.1;
  const gainLongStreak = longStreak.winnerPoints - 0.1;
  assert.ok(gainLongStreak > gainNoStreak, `expected a bigger gain on a win streak: ${gainLongStreak} vs ${gainNoStreak}`);
});
