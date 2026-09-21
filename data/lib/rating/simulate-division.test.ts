// data/lib/rating/simulate-division.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulateDivisionRatings, pointsAsOf, type DivisionFightInput, type SimulatedFighterState } from './simulate-division';
import { HAND_PICKED_POINT_FLOW_PARAMS } from './point-flow';
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

function stateWith(points: number, lastFightDate: string | null): SimulatedFighterState {
  return { points, currentStreak: 3, isFormerChampion: true, lastFightDate, fightsSimulated: 5 };
}

test('pointsAsOf leaves a recently active fighter untouched, within the grace period', () => {
  // Hand-picked set: 12-month grace.
  assert.equal(pointsAsOf(stateWith(2, '2026-01-01'), '2026-09-17', HAND_PICKED_POINT_FLOW_PARAMS), 2);
});

test('pointsAsOf erodes a long-inactive fighter down to the floor, never below', () => {
  const retired = stateWith(2, '2016-11-12');
  const eroded = pointsAsOf(retired, '2026-09-17', HAND_PICKED_POINT_FLOW_PARAMS);
  assert.ok(Math.abs(eroded - 2 * HAND_PICKED_POINT_FLOW_PARAMS.erosionFloorShare) < 1e-9, `expected the 40% floor, got ${eroded}`);
});

test('pointsAsOf erodes partially between the grace period and the floor, and more the longer the inactivity', () => {
  const p = HAND_PICKED_POINT_FLOW_PARAMS;
  const after18Months = pointsAsOf(stateWith(1, '2025-03-17'), '2026-09-17', p);
  const after24Months = pointsAsOf(stateWith(1, '2024-09-17'), '2026-09-17', p);
  assert.ok(after18Months < 1 && after18Months > p.erosionFloorShare, `got ${after18Months}`);
  assert.ok(after24Months < after18Months, `${after24Months} should be below ${after18Months}`);
});

test('pointsAsOf does not mutate the simulated state', () => {
  const state = stateWith(2, '2016-11-12');
  pointsAsOf(state, '2026-09-17');
  assert.equal(state.points, 2);
});

function win(date: string, winnerId: number, loserId: number): DivisionFightInput {
  return { fightUrl: `${date}-${winnerId}`, eventDate: date, isTitleFight: false, isFiveRounds: false, winnerId, loserId, winnerSide: koSide(), loserSide: lossSide() };
}

test('a no contest restarts the inactivity clock without transferring points or adding history', () => {
  const fights = [win('2023-01-01', 1, 2), win('2024-07-27', 1, 3)];
  const withoutNc = simulateDivisionRatings(fights, HAND_PICKED_POINT_FLOW_PARAMS);
  const withNc = simulateDivisionRatings(fights, HAND_PICKED_POINT_FLOW_PARAMS, [{ eventDate: '2025-10-25', fighterIds: [1, 99], isDraw: false }]);

  const a = withoutNc.fighterStates.get(1)!;
  const b = withNc.fighterStates.get(1)!;
  assert.equal(b.lastFightDate, '2025-10-25');
  assert.equal(b.points, pointsAsOf(a, '2025-10-25', HAND_PICKED_POINT_FLOW_PARAMS), 'the 3 months of erosion past the grace period are banked at the no contest');
  assert.equal(b.currentStreak, 2, 'a no contest does not end a win streak');
  assert.equal(b.fightsSimulated, 2);
  assert.equal(withNc.history.length, 2);
  assert.ok(!withNc.fighterStates.has(99), 'a no contest alone does not create a rating');
  assert.ok(pointsAsOf(b, '2026-09-17', HAND_PICKED_POINT_FLOW_PARAMS) > pointsAsOf(a, '2026-09-17', HAND_PICKED_POINT_FLOW_PARAMS));
});

test('erosion accrued before a no contest is banked, not forgiven', () => {
  const fights = [win('2018-01-01', 1, 2)];
  const result = simulateDivisionRatings(fights, HAND_PICKED_POINT_FLOW_PARAMS, [{ eventDate: '2025-01-01', fighterIds: [1, 2], isDraw: false }]);
  const before = simulateDivisionRatings(fights, HAND_PICKED_POINT_FLOW_PARAMS).fighterStates.get(1)!;
  assert.ok(Math.abs(result.fighterStates.get(1)!.points - before.points * HAND_PICKED_POINT_FLOW_PARAMS.erosionFloorShare) < 1e-12);
});

test('a draw resets the streak; a no contest before a later fight is applied first', () => {
  const fights = [win('2020-01-01', 1, 2), win('2020-03-01', 1, 3), win('2022-01-01', 1, 4)];
  const result = simulateDivisionRatings(fights, HAND_PICKED_POINT_FLOW_PARAMS, [{ eventDate: '2021-01-01', fighterIds: [1, 5], isDraw: true }]);
  assert.equal(result.fighterStates.get(1)!.currentStreak, 1, 'the draw ended the 2-fight streak, the 2022 win starts a new one');
  assert.equal(result.fighterStates.get(1)!.lastFightDate, '2022-01-01');
});
