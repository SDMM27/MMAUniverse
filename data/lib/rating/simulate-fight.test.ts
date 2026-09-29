import { test } from 'node:test';
import assert from 'node:assert/strict';
import { predictFight } from './simulate-fight';

test('equal ratings give a coin flip', () => {
  const p = predictFight({ rating: 1700, rd: 60 }, { rating: 1700, rd: 60 });
  assert.equal(p.winA, 0.5);
  assert.equal(p.ratingGap, 0);
});

test('the result does not depend on which corner is A', () => {
  const a = { rating: 1850, rd: 45 };
  const b = { rating: 1700, rd: 120 };
  const ab = predictFight(a, b);
  const ba = predictFight(b, a);
  assert.ok(Math.abs(ab.winA - ba.winB) < 1e-12);
  assert.ok(Math.abs(ab.winA + ab.winB - 1) < 1e-12);
});

test('the higher-rated fighter is favoured, more so when both are certain', () => {
  const sure = predictFight({ rating: 1800, rd: 40 }, { rating: 1700, rd: 40 });
  const unsure = predictFight({ rating: 1800, rd: 250 }, { rating: 1700, rd: 250 });
  assert.ok(sure.winA > 0.5);
  assert.ok(unsure.winA > 0.5);
  assert.ok(sure.winA > unsure.winA);
});

test('confidence follows the least certain fighter', () => {
  assert.equal(predictFight({ rating: 1700, rd: 150 }, { rating: 1700, rd: 165 }).confidence, 'high');
  assert.equal(predictFight({ rating: 1700, rd: 150 }, { rating: 1700, rd: 200 }).confidence, 'medium');
  assert.equal(predictFight({ rating: 1700, rd: 150 }, { rating: 1700, rd: 250 }).confidence, 'low');
});
