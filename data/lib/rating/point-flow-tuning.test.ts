// data/lib/rating/point-flow-tuning.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { winProbabilityFromPoints, evaluateLogRatios, fitScale, collectWinnerLogRatios, patternSearch } from './point-flow-tuning';
import { HAND_PICKED_POINT_FLOW_PARAMS, type PointFlowParams } from './point-flow';
import type { DivisionFightInput } from './simulate-division';
import type { FightStatsSide } from './dominance-score';

test('winProbabilityFromPoints is 0.5 for equal points, symmetric, and follows the Bradley-Terry ratio', () => {
  assert.equal(winProbabilityFromPoints(0.3, 0.3, 2), 0.5);
  const pAB = winProbabilityFromPoints(0.4, 0.1, 1);
  assert.ok(Math.abs(pAB + winProbabilityFromPoints(0.1, 0.4, 1) - 1) < 1e-12);
  assert.ok(Math.abs(pAB - 0.4 / (0.4 + 0.1)) < 1e-12, `k=1 should be a/(a+b), got ${pAB}`);
  assert.ok(Math.abs(winProbabilityFromPoints(0.4, 0.1, 2) - 0.16 / (0.16 + 0.01)) < 1e-12);
});

test('evaluateLogRatios: all-zero ratios score exactly a coin flip', () => {
  const metrics = evaluateLogRatios([0, 0, 0, 0], 3);
  assert.ok(Math.abs(metrics.logLoss - Math.log(2)) < 1e-12);
  assert.equal(metrics.accuracy, 0.5);
  assert.equal(metrics.count, 4);
});

test('evaluateLogRatios counts a positive ratio as a correct pick and a negative one as wrong', () => {
  const metrics = evaluateLogRatios([1, 1, -1, 0], 1);
  assert.equal(metrics.accuracy, (1 + 1 + 0 + 0.5) / 4);
});

test('fitScale returns 0 with no signal, and recovers a larger k for a sharper signal', () => {
  assert.equal(fitScale([0, 0, 0]), 0);
  // 3 of 4 favourites win at ratio 1 -> optimal sigmoid(k) = 0.75 -> k = ln 3.
  const k = fitScale([1, 1, 1, -1]);
  assert.ok(Math.abs(k - Math.log(3)) < 1e-6, `expected ln 3, got ${k}`);
  // 9 of 10 favourites win -> k = ln 9, sharper.
  const sharper = fitScale([1, 1, 1, 1, 1, 1, 1, 1, 1, -1]);
  assert.ok(Math.abs(sharper - Math.log(9)) < 1e-6, `expected ln 9, got ${sharper}`);
});

test('fitScale minimizes log-loss (nudging k either way does not help)', () => {
  const ratios = [0.5, 1.2, -0.3, 2, 0.1, -1, 0.7];
  const k = fitScale(ratios);
  const at = evaluateLogRatios(ratios, k).logLoss;
  assert.ok(at <= evaluateLogRatios(ratios, k * 1.05).logLoss);
  assert.ok(at <= evaluateLogRatios(ratios, k * 0.95).logLoss);
});

function side(): FightStatsSide {
  return { method: 'Decision - Unanimous', finishRound: 3, sigStrikesLandedTotal: 50, controlTimeSecondsTotal: 60, rounds: [] };
}

function fight(date: string, winnerId: number, loserId: number): DivisionFightInput {
  return { fightUrl: `${date}-${winnerId}-${loserId}`, eventDate: date, isTitleFight: false, isFiveRounds: false, winnerId, loserId, winnerSide: side(), loserSide: side() };
}

test('collectWinnerLogRatios is point-in-time: a debut fight is predicted at ratio 0, a rematch reflects the first result', () => {
  const fights = [fight('2020-01-01', 1, 2), fight('2021-01-01', 1, 2), fight('2022-01-01', 2, 1)];
  const { train, test: testRatios } = collectWinnerLogRatios([{ fights }], HAND_PICKED_POINT_FLOW_PARAMS, '2022-01-01');
  assert.equal(train.length, 2);
  assert.equal(testRatios.length, 1);
  assert.equal(train[0], 0);
  assert.ok(train[1] > 0, `fighter 1 already beat fighter 2, the rematch should favour them: ${train[1]}`);
  assert.ok(testRatios[0] < 0, `fighter 2 was the underdog in the third fight: ${testRatios[0]}`);
});

test('patternSearch finds the minimum of a simple bowl within bounds, and respects integer/bounds constraints', () => {
  const objective = (p: PointFlowParams) => (p.opponentShare - 0.4) ** 2 + (p.erosionGraceMonths - 7) ** 2 + (p.titleWinMultiplier - 0.2) ** 2;
  const result = patternSearch(
    objective,
    HAND_PICKED_POINT_FLOW_PARAMS,
    {
      opponentShare: { min: 0.01, max: 2, kind: 'log', step: 2 },
      erosionGraceMonths: { min: 0, max: 36, kind: 'linear', step: 4, integer: true },
      titleWinMultiplier: { min: 1, max: 3, kind: 'linear', step: 0.5 },
    },
    { refinements: 12 },
  );
  assert.ok(Math.abs(result.params.opponentShare - 0.4) < 0.02, `opponentShare ${result.params.opponentShare}`);
  assert.equal(result.params.erosionGraceMonths, 7);
  assert.equal(result.params.titleWinMultiplier, 1, 'the unconstrained optimum 0.2 is below the bound, must stop at 1');
  assert.equal(result.params.streakStep, HAND_PICKED_POINT_FLOW_PARAMS.streakStep, 'params outside the search space are left untouched');
});
