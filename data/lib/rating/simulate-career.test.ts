// data/lib/rating/simulate-career.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulateCareerRatings, ratingAsOf, type CareerFightInput } from './simulate-career';
import { DEFAULT_GLICKO_PARAMS, type GlickoParams } from './glicko-rating';
import type { FightStatsSide } from './dominance-score';

const params: GlickoParams = { ...DEFAULT_GLICKO_PARAMS, carryOverShare: 1, rdOnDivisionChange: 50, rdPerMonth: 20 };

function side(method: string, strikes: number): FightStatsSide {
  return { method, finishRound: 3, sigStrikesLandedTotal: strikes, controlTimeSecondsTotal: 0, rounds: [{ round: 1, sigStrikesLanded: strikes, controlTimeSeconds: 0, knockdowns: 0 }] };
}

function fight(url: string, date: string, division: string, winnerId: number, loserId: number, isTitleFight = false): CareerFightInput {
  return { fightUrl: url, eventDate: date, division, isTitleFight, isFiveRounds: isTitleFight, winnerId, loserId, winnerSide: side('U-DEC', 60), loserSide: side('U-DEC', 30) };
}

test('ratings carry over across weight classes instead of restarting', () => {
  const fights = [
    fight('a', '2020-01-01', 'Lightweight', 1, 2),
    fight('b', '2020-06-01', 'Lightweight', 1, 3),
    fight('c', '2021-01-01', 'Lightweight', 1, 4),
    fight('d', '2021-06-01', 'Welterweight', 1, 5),
  ];
  const { fighterStates, history } = simulateCareerRatings(fights, [], params);
  const move = history[3];
  assert.equal(move.winnerChangedDivision, true);
  assert.ok(move.winnerBefore.rating > params.initialRating + 50, 'the move into welterweight starts from the lightweight rating');
  assert.equal(move.winnerUfcFightsBefore, 3);
  const state = fighterStates.get(1)!;
  assert.equal(state.lastDivision, 'Welterweight');
  assert.equal(state.ufcFights, 4);
  assert.equal(state.lastFightDateByDivision.get('Lightweight'), '2021-01-01');
  assert.equal(state.lastFightDateByDivision.get('Welterweight'), '2021-06-01');
});

test('a division change raises the uncertainty before the fight', () => {
  const fights = [fight('a', '2020-01-01', 'Lightweight', 1, 2), fight('b', '2020-01-01', 'Welterweight', 1, 3)];
  const { history } = simulateCareerRatings(fights, [], params);
  assert.ok(history[1].winnerBefore.rd > history[0].winnerAfter.rd);
});

test('beating a highly rated opponent is worth more than beating a debutant', () => {
  const build = (lastOpponent: number) => [
    fight('a', '2020-01-01', 'Lightweight', 2, 10),
    fight('b', '2020-02-01', 'Lightweight', 2, 11),
    fight('c', '2020-03-01', 'Lightweight', 2, 12),
    fight('d', '2020-04-01', 'Lightweight', 1, lastOpponent),
  ];
  const vsStrong = simulateCareerRatings(build(2), [], params).fighterStates.get(1)!.rating;
  const vsDebutant = simulateCareerRatings(build(99), [], params).fighterStates.get(1)!.rating;
  assert.ok(vsStrong > vsDebutant);
});

test('fight volume alone does not inflate a rating the way the point flow did', () => {
  // Fighter 1 beats five debutants; fighter 20 beats one opponent who had himself won four.
  const fights = [
    fight('a1', '2020-01-01', 'Lightweight', 1, 101),
    fight('a2', '2020-02-01', 'Lightweight', 1, 102),
    fight('a3', '2020-03-01', 'Lightweight', 1, 103),
    fight('a4', '2020-04-01', 'Lightweight', 1, 104),
    fight('b1', '2020-01-01', 'Lightweight', 30, 201),
    fight('b2', '2020-02-01', 'Lightweight', 30, 202),
    fight('b3', '2020-03-01', 'Lightweight', 30, 203),
    fight('b4', '2020-04-01', 'Lightweight', 30, 204),
    fight('c1', '2020-05-01', 'Lightweight', 20, 30),
  ];
  const { fighterStates } = simulateCareerRatings(fights, [], params);
  assert.ok(fighterStates.get(20)!.rating > fighterStates.get(30)!.rating);
});

test('a no contest counts as a bout (last fight date, division) for already-rated fighters without moving their rating', () => {
  const fights = [fight('a', '2020-01-01', 'Lightweight', 1, 2)];
  const withNc = simulateCareerRatings(fights, [{ eventDate: '2021-12-01', fighterIds: [1, 4], isDraw: false, division: 'Welterweight' }], params);
  const without = simulateCareerRatings(fights, [], params);
  const state = withNc.fighterStates.get(1)!;
  assert.equal(state.lastFightDate, '2021-12-01');
  assert.equal(state.lastDivision, 'Welterweight');
  assert.equal(state.lastFightDateByDivision.get('Welterweight'), '2021-12-01');
  assert.equal(state.rating, without.fighterStates.get(1)!.rating);
  assert.equal(state.ufcFights, 1);
  assert.equal(withNc.fighterStates.has(4), false);
});

test('ratingAsOf inflates the RD for inactivity up to the given date, rating unchanged', () => {
  const { fighterStates } = simulateCareerRatings([fight('a', '2020-01-01', 'Lightweight', 1, 2)], [], params);
  const state = fighterStates.get(1)!;
  const later = ratingAsOf(state, '2022-01-01', params);
  assert.equal(later.rating, state.rating);
  assert.ok(later.rd > state.rd);
});
