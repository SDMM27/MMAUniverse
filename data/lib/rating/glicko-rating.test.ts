// data/lib/rating/glicko-rating.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_GLICKO_PARAMS,
  rdAfterInactivity,
  applyDivisionChange,
  winnerOutcomeScore,
  updateGlicko,
  conservativeRating,
  scoreAgainstReference,
  type GlickoParams,
} from './glicko-rating';

const params: GlickoParams = { ...DEFAULT_GLICKO_PARAMS, initialRating: 1500, initialRd: 300, rdPerMonth: 20, rdOnDivisionChange: 50, carryOverShare: 1, winScoreFloor: 0.5, minRd: 30 };

test('rdAfterInactivity grows with time and is capped at the initial RD', () => {
  assert.equal(rdAfterInactivity(100, 0, params), 100);
  assert.ok(rdAfterInactivity(100, 12, params) > 100);
  assert.ok(rdAfterInactivity(100, 12, params) > rdAfterInactivity(100, 3, params));
  assert.equal(rdAfterInactivity(100, 1000, params), 300);
});

test('applyDivisionChange keeps the full rating when carryOverShare is 1, and raises the RD', () => {
  const moved = applyDivisionChange({ rating: 2000, rd: 80 }, params);
  assert.equal(moved.rating, 2000);
  assert.ok(moved.rd > 80);
});

test('applyDivisionChange shrinks the rating toward the initial rating by carryOverShare', () => {
  const moved = applyDivisionChange({ rating: 2000, rd: 80 }, { ...params, carryOverShare: 0.8 });
  assert.equal(moved.rating, 1900);
});

test('winnerOutcomeScore maps dominance 0..1 onto winScoreFloor..1', () => {
  const p = { ...params, winScoreFloor: 0.7 };
  assert.equal(winnerOutcomeScore(0, p), 0.7);
  assert.equal(winnerOutcomeScore(1, p), 1);
  assert.ok(Math.abs(winnerOutcomeScore(0.5, p) - 0.85) < 1e-12);
});

test('a favourite who wins gains less than an underdog who wins', () => {
  const strong = { rating: 1800, rd: 80 };
  const weak = { rating: 1500, rd: 80 };
  const favouriteGain = updateGlicko(strong, weak, 1, params).rating - strong.rating;
  const underdogGain = updateGlicko(weak, strong, 1, params).rating - weak.rating;
  assert.ok(favouriteGain > 0);
  assert.ok(underdogGain > favouriteGain);
});

test('updateGlicko: the loser drops, and both RDs shrink after a fight', () => {
  const a = { rating: 1600, rd: 150 };
  const b = { rating: 1600, rd: 150 };
  const winner = updateGlicko(a, b, 1, params);
  const loser = updateGlicko(b, a, 0, params);
  assert.ok(winner.rating > 1600);
  assert.ok(loser.rating < 1600);
  assert.ok(Math.abs(winner.rating - 1600 - (1600 - loser.rating)) < 1e-9); // symmetric for equal RDs
  assert.ok(winner.rd < 150 && loser.rd < 150);
});

test('updateGlicko never lets the RD fall below minRd', () => {
  let s = { rating: 1500, rd: 40 };
  for (let i = 0; i < 50; i++) s = updateGlicko(s, { rating: 1500, rd: 40 }, 1, params);
  assert.ok(s.rd >= params.minRd);
});

test('a decisive win moves the rating more than a narrow one', () => {
  const a = { rating: 1500, rd: 100 };
  const p = { ...params, winScoreFloor: 0.6 };
  const narrow = updateGlicko(a, a, winnerOutcomeScore(0, p), p).rating;
  const decisive = updateGlicko(a, a, winnerOutcomeScore(1, p), p).rating;
  assert.ok(decisive > narrow);
});

test('conservativeRating is rating minus two RDs', () => {
  assert.equal(conservativeRating(2000, 100), 1800);
});

test('scoreAgainstReference: 100 at the reference, about 48 two hundred points below, never above 100', () => {
  assert.equal(scoreAgainstReference(1800, 1800), 100);
  const below = scoreAgainstReference(1600, 1800);
  assert.ok(below > 47 && below < 49);
  assert.equal(scoreAgainstReference(1900, 1800), 100);
  assert.ok(scoreAgainstReference(1000, 1800) >= 0);
});
