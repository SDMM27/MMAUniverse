// data/lib/rating/simulate-division.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulateDivisionRatings, type DivisionFightInput } from './simulate-division';
import type { FightStatsSide } from './dominance-score';

function koSide(overrides: Partial<FightStatsSide> = {}): FightStatsSide {
  return {
    method: 'KO/TKO',
    finishRound: 1,
    sigStrikesLandedTotal: 15,
    controlTimeSecondsTotal: 5,
    rounds: [{ round: 1, sigStrikesLanded: 15, controlTimeSeconds: 5, knockdowns: 1 }],
    ...overrides,
  };
}

function lossSide(overrides: Partial<FightStatsSide> = {}): FightStatsSide {
  return {
    method: 'KO/TKO',
    finishRound: 1,
    sigStrikesLandedTotal: 3,
    controlTimeSecondsTotal: 0,
    rounds: [{ round: 1, sigStrikesLanded: 3, controlTimeSeconds: 0, knockdowns: 0 }],
    ...overrides,
  };
}

test('a fighter who wins every fight accumulates points and a growing win streak', () => {
  const fights: DivisionFightInput[] = [
    { fightUrl: 'f1', eventDate: '2020-01-01', isTitleFight: false, isFiveRounds: false, winnerId: 1, loserId: 2, winnerSide: koSide(), loserSide: lossSide() },
    { fightUrl: 'f2', eventDate: '2020-06-01', isTitleFight: false, isFiveRounds: false, winnerId: 1, loserId: 3, winnerSide: koSide(), loserSide: lossSide() },
    { fightUrl: 'f3', eventDate: '2020-12-01', isTitleFight: false, isFiveRounds: false, winnerId: 1, loserId: 4, winnerSide: koSide(), loserSide: lossSide() },
  ];

  const result = simulateDivisionRatings(fights);
  const fighter1 = result.fighterStates.get(1)!;

  assert.equal(fighter1.currentStreak, 3);
  assert.equal(fighter1.fightsSimulated, 3);
  assert.ok(fighter1.points > 0.01, `expected points to have grown past the base, got ${fighter1.points}`);
  assert.equal(result.history.length, 3);
});

test('a loss streak goes negative and resets a fighter\'s momentum', () => {
  const fights: DivisionFightInput[] = [
    { fightUrl: 'f1', eventDate: '2020-01-01', isTitleFight: false, isFiveRounds: false, winnerId: 1, loserId: 2, winnerSide: koSide(), loserSide: lossSide() },
    { fightUrl: 'f2', eventDate: '2020-06-01', isTitleFight: false, isFiveRounds: false, winnerId: 3, loserId: 1, winnerSide: koSide(), loserSide: lossSide() },
    { fightUrl: 'f3', eventDate: '2020-12-01', isTitleFight: false, isFiveRounds: false, winnerId: 4, loserId: 1, winnerSide: koSide(), loserSide: lossSide() },
  ];

  const result = simulateDivisionRatings(fights);
  const fighter1 = result.fighterStates.get(1)!;

  assert.equal(fighter1.currentStreak, -2);
});

test('winning a title fight makes a fighter a former champion starting their next fight, not the title-winning one', () => {
  const fights: DivisionFightInput[] = [
    { fightUrl: 'f1', eventDate: '2020-01-01', isTitleFight: true, isFiveRounds: true, winnerId: 1, loserId: 2, winnerSide: koSide(), loserSide: lossSide() },
    { fightUrl: 'f2', eventDate: '2020-06-01', isTitleFight: false, isFiveRounds: false, winnerId: 1, loserId: 3, winnerSide: koSide(), loserSide: lossSide() },
  ];

  const result = simulateDivisionRatings(fights);
  const fighter1 = result.fighterStates.get(1)!;

  assert.equal(fighter1.isFormerChampion, true);
  // The gain from f2 (non-title) should reflect the former-champion 1.5x
  // multiplier -- confirm indirectly by checking it's bigger than a fresh,
  // otherwise-identical challenger's win over the same-strength opponent.
  const otherFights: DivisionFightInput[] = [
    { fightUrl: 'g1', eventDate: '2020-01-01', isTitleFight: false, isFiveRounds: false, winnerId: 10, loserId: 20, winnerSide: koSide(), loserSide: lossSide() },
    { fightUrl: 'g2', eventDate: '2020-06-01', isTitleFight: false, isFiveRounds: false, winnerId: 10, loserId: 3, winnerSide: koSide(), loserSide: lossSide() },
  ];
  const otherResult = simulateDivisionRatings(otherFights);
  const fighter10 = otherResult.fighterStates.get(10)!;
  assert.ok(fighter1.points > fighter10.points, `expected the former champion (${fighter1.points}) to have gained more than a non-champion (${fighter10.points})`);
});

test('the division average used for a fight includes both corners even on their first-ever appearance', () => {
  // A brand new division: first fight has two never-seen fighters, so the
  // "division average" going in is exactly 2 fighters at BASE_POINTS each --
  // this doesn't assert the internal average directly (private to the
  // function), just that the simulation runs without error and produces
  // sane, non-NaN output for a division's very first fight.
  const fights: DivisionFightInput[] = [
    { fightUrl: 'f1', eventDate: '2020-01-01', isTitleFight: false, isFiveRounds: false, winnerId: 1, loserId: 2, winnerSide: koSide(), loserSide: lossSide() },
  ];

  const result = simulateDivisionRatings(fights);
  assert.ok(Number.isFinite(result.fighterStates.get(1)!.points));
  assert.ok(Number.isFinite(result.fighterStates.get(2)!.points));
});

test('an empty fight list returns an empty simulation', () => {
  const result = simulateDivisionRatings([]);
  assert.equal(result.fighterStates.size, 0);
  assert.deepEqual(result.history, []);
});
