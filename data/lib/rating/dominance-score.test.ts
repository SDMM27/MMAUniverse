// data/lib/rating/dominance-score.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeDominanceScore, type FightStatsSide } from './dominance-score';

function side(overrides: Partial<FightStatsSide>): FightStatsSide {
  return {
    method: 'Decision - Unanimous',
    finishRound: null,
    sigStrikesLandedTotal: 0,
    controlTimeSecondsTotal: 0,
    rounds: [],
    ...overrides,
  };
}

test('a round-1 KO/TKO scores near the top of the range (finish bonus + trivial roundsWonShare both max)', () => {
  const winner = side({
    method: 'KO/TKO',
    finishRound: 1,
    sigStrikesLandedTotal: 20,
    controlTimeSecondsTotal: 10,
    rounds: [{ round: 1, sigStrikesLanded: 20, controlTimeSeconds: 10, knockdowns: 1 }],
  });
  const loser = side({
    sigStrikesLandedTotal: 5,
    controlTimeSecondsTotal: 0,
    rounds: [{ round: 1, sigStrikesLanded: 5, controlTimeSeconds: 0, knockdowns: 0 }],
  });

  const result = computeDominanceScore(winner, loser);
  assert.equal(result.estimated, false);
  assert.ok(result.score > 0.85, `expected > 0.85, got ${result.score}`);
});

test('a decision won by sweeping every round (the Khabib case) scores clearly above an ordinary decision but clearly below a finish', () => {
  const winnerRound = { round: 0, sigStrikesLanded: 15, controlTimeSeconds: 180, knockdowns: 0 };
  const loserRound = { round: 0, sigStrikesLanded: 3, controlTimeSeconds: 0, knockdowns: 0 };
  const winner = side({
    method: 'Decision - Unanimous',
    finishRound: null,
    sigStrikesLandedTotal: 45,
    controlTimeSecondsTotal: 540,
    rounds: [1, 2, 3].map((round) => ({ ...winnerRound, round })),
  });
  const loser = side({
    sigStrikesLandedTotal: 9,
    controlTimeSecondsTotal: 0,
    rounds: [1, 2, 3].map((round) => ({ ...loserRound, round })),
  });

  const result = computeDominanceScore(winner, loser);
  assert.equal(result.estimated, false);
  // Indicative range from the design spec's worked example (~0.655-0.66) --
  // asserted with headroom since the exact constant is calibration-pending.
  assert.ok(result.score > 0.55 && result.score < 0.8, `expected between 0.55 and 0.8, got ${result.score}`);
});

test('a split-style decision (winner clearly ahead in only 1 of 3 rounds) scores distinctly lower than a full round-sweep decision', () => {
  const winner = side({
    method: 'Decision - Split',
    finishRound: null,
    sigStrikesLandedTotal: 25,
    controlTimeSecondsTotal: 60,
    rounds: [
      { round: 1, sigStrikesLanded: 15, controlTimeSeconds: 60, knockdowns: 0 }, // winner wins this round clearly
      { round: 2, sigStrikesLanded: 5, controlTimeSeconds: 0, knockdowns: 0 }, // loser wins this round clearly
      { round: 3, sigStrikesLanded: 5, controlTimeSeconds: 0, knockdowns: 0 }, // loser wins this round clearly
    ],
  });
  const loser = side({
    sigStrikesLandedTotal: 35,
    controlTimeSecondsTotal: 120,
    rounds: [
      { round: 1, sigStrikesLanded: 5, controlTimeSeconds: 0, knockdowns: 0 },
      { round: 2, sigStrikesLanded: 15, controlTimeSeconds: 60, knockdowns: 0 },
      { round: 3, sigStrikesLanded: 15, controlTimeSeconds: 60, knockdowns: 0 },
    ],
  });

  const result = computeDominanceScore(winner, loser);
  assert.equal(result.estimated, false);
  assert.ok(result.score < 0.35, `expected a low score for a split-style decision, got ${result.score}`);
});

test('a submission scores slightly lower than an otherwise-identical KO/TKO (bonus_finish 0.9 vs 1.0)', () => {
  const roundsFor = (sigStrikes: number, control: number, kd: number) => [
    { round: 1, sigStrikesLanded: sigStrikes, controlTimeSeconds: control, knockdowns: kd },
  ];
  const koWinner = side({
    method: 'KO/TKO',
    finishRound: 1,
    sigStrikesLandedTotal: 20,
    controlTimeSecondsTotal: 10,
    rounds: roundsFor(20, 10, 1),
  });
  const subWinner = side({ ...koWinner, method: 'Submission' });
  const loser = side({
    sigStrikesLandedTotal: 5,
    controlTimeSecondsTotal: 0,
    rounds: roundsFor(5, 0, 0),
  });

  const koResult = computeDominanceScore(koWinner, loser);
  const subResult = computeDominanceScore(subWinner, loser);

  assert.ok(subResult.score < koResult.score, `expected submission (${subResult.score}) < KO/TKO (${koResult.score})`);
  // Only the bonus_finish term (weight 0.3) differs, by 0.1 -- a 0.03 gap.
  assert.ok(Math.abs(koResult.score - subResult.score - 0.03) < 0.001);
});

test('roundsWonShare and the aggregate strike differential can disagree without one masking the other', () => {
  // One huge outlier round for the winner, then two rounds close enough to
  // tie or go the other way -- aggregate strikes favor the winner heavily
  // (dominated by the outlier round) while roundsWonShare stays moderate.
  const winner = side({
    method: 'Decision - Unanimous',
    finishRound: null,
    sigStrikesLandedTotal: 70,
    controlTimeSecondsTotal: 0,
    rounds: [
      { round: 1, sigStrikesLanded: 50, controlTimeSeconds: 0, knockdowns: 0 },
      { round: 2, sigStrikesLanded: 10, controlTimeSeconds: 0, knockdowns: 0 },
      { round: 3, sigStrikesLanded: 10, controlTimeSeconds: 0, knockdowns: 0 },
    ],
  });
  const loser = side({
    sigStrikesLandedTotal: 31.5,
    controlTimeSecondsTotal: 0,
    rounds: [
      { round: 1, sigStrikesLanded: 10, controlTimeSeconds: 0, knockdowns: 0 }, // winner wins round 1 clearly
      { round: 2, sigStrikesLanded: 11, controlTimeSeconds: 0, knockdowns: 0 }, // loser wins round 2
      { round: 3, sigStrikesLanded: 10.5, controlTimeSeconds: 0, knockdowns: 0 }, // within the 5% tie margin
    ],
  });

  const result = computeDominanceScore(winner, loser);
  // roundsWonShare = (1 + 0 + 0.5) / 3 = 0.5; strikeDifferential = 70/101.5 ≈ 0.69 --
  // the two terms disagree by a wide margin, confirming neither one alone
  // determines the round-by-round outcome.
  assert.equal(result.estimated, false);
  assert.ok(result.score > 0.3 && result.score < 0.5, `expected a moderate blended score, got ${result.score}`);
});

test('falls back to method alone when round-by-round data is unavailable', () => {
  const koWinner = side({ method: 'KO/TKO', rounds: [] });
  const subWinner = side({ method: 'Submission', rounds: [] });
  const decisionWinner = side({ method: 'Decision - Unanimous', rounds: [] });
  const loser = side({ rounds: [] });

  const koResult = computeDominanceScore(koWinner, loser);
  const subResult = computeDominanceScore(subWinner, loser);
  const decisionResult = computeDominanceScore(decisionWinner, loser);

  assert.deepEqual(koResult, { score: 1.0, estimated: true });
  assert.deepEqual(subResult, { score: 0.9, estimated: true });
  assert.deepEqual(decisionResult, { score: 0.4, estimated: true });
});
