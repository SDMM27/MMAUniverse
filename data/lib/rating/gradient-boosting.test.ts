import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitGbm, predictGbm, DEFAULT_GBM_PARAMS } from './gradient-boosting';

// Deterministic pseudo-random points in [-1, 1]^2.
function points(n: number, seed: number): number[][] {
  let s = seed;
  const next = () => ((s = (s * 16807) % 2147483647) / 2147483647) * 2 - 1;
  return Array.from({ length: n }, () => [next(), next()]);
}

test('fitGbm learns an interaction a linear model cannot (XOR of signs)', () => {
  const x = points(2000, 7);
  const y = x.map(([a, b]) => (a * b > 0 ? 1 : 0));
  const { model } = fitGbm(x, y, { ...DEFAULT_GBM_PARAMS, trees: 200, maxDepth: 2 });
  const test = points(400, 11);
  const correct = test.filter(([a, b]) => (predictGbm(model, [a, b]) > 0.5) === a * b > 0).length;
  assert.ok(correct / test.length > 0.9, `accuracy ${correct / test.length}`);
});

test('fitGbm early stopping keeps the trees up to the best validation loss', () => {
  const x = points(600, 3);
  const y = x.map(([a]) => (a > 0 ? 1 : 0));
  const valid = { x: points(300, 5), y: [] as number[] };
  valid.y = valid.x.map(([a]) => (a > 0 ? 1 : 0));
  const { model, validLoss } = fitGbm(x, y, { ...DEFAULT_GBM_PARAMS, trees: 300 }, valid);
  const best = validLoss.indexOf(Math.min(...validLoss)) + 1;
  assert.equal(model.trees.length, best);
});

test('missing values get their own bin', () => {
  const x = Array.from({ length: 400 }, (_, i) => [i % 2 ? NaN : i / 400]);
  const y = x.map(([v]) => (Number.isNaN(v) ? 1 : 0));
  const { model } = fitGbm(x, y, { ...DEFAULT_GBM_PARAMS, trees: 100 });
  assert.ok(predictGbm(model, [NaN]) > 0.9);
  assert.ok(predictGbm(model, [0.5]) < 0.1);
});
