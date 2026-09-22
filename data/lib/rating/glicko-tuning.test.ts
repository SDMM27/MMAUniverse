// data/lib/rating/glicko-tuning.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectCareerRatingDiffs } from './glicko-tuning';
import { DEFAULT_GLICKO_PARAMS } from './glicko-rating';
import type { CareerFightInput } from './simulate-career';
import type { FightStatsSide } from './dominance-score';

const winnerSide: FightStatsSide = { method: 'KO/TKO', finishRound: 1, sigStrikesLandedTotal: 30, controlTimeSecondsTotal: 0, rounds: [{ round: 1, sigStrikesLanded: 30, controlTimeSeconds: 0, knockdowns: 2 }] };
const loserSide: FightStatsSide = { method: 'KO/TKO', finishRound: 1, sigStrikesLandedTotal: 2, controlTimeSecondsTotal: 0, rounds: [{ round: 1, sigStrikesLanded: 2, controlTimeSeconds: 0, knockdowns: 0 }] };
const fight = (url: string, date: string, division: string, w: number, l: number): CareerFightInput => ({
  fightUrl: url, eventDate: date, division, isTitleFight: false, isFiveRounds: false, winnerId: w, loserId: l, winnerSide, loserSide,
});

test('collectCareerRatingDiffs splits pre-fight winner-minus-loser ratings by date, and flags division movers', () => {
  const fights = [
    fight('a', '2020-01-01', 'Lightweight', 1, 2),
    fight('b', '2021-01-01', 'Welterweight', 1, 3),
    fight('c', '2021-02-01', 'Lightweight', 4, 5),
  ];
  const split = collectCareerRatingDiffs(fights, [], DEFAULT_GLICKO_PARAMS, '2021-01-01');
  assert.deepEqual(split.train, [0]); // two debutants
  assert.equal(split.test.length, 2);
  assert.ok(split.test[0] > 0); // fighter 1 already won once
  assert.equal(split.test[1], 0);
  assert.deepEqual(split.testMovers, [split.test[0]]); // only fight b involves a fighter who had fought in another division
});
