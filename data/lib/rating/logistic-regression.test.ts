import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trainLogisticRegression, predictProbability, logLoss } from './logistic-regression';

test('learns a perfectly separable 1D threshold', () => {
  const features: number[][] = [];
  const labels: number[] = [];
  for (let x = -10; x <= 10; x++) {
    features.push([x]);
    labels.push(x > 0 ? 1 : 0);
  }

  const model = trainLogisticRegression(features, labels, { l2: 0 });

  assert.ok(predictProbability(model, [8]) > 0.9, 'confidently predicts the positive class well past the boundary');
  assert.ok(predictProbability(model, [-8]) < 0.1, 'confidently predicts the negative class well past the boundary');
  assert.ok(Math.abs(predictProbability(model, [0]) - 0.5) < 0.15, 'stays near 0.5 right at the decision boundary');
});

test('assigns near-zero weight to a feature that carries no signal', () => {
  const features: number[][] = [];
  const labels: number[] = [];
  // mulberry32-style deterministic PRNG so the noise feature is reproducible.
  let state = 42;
  const rand = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  for (let x = -20; x <= 20; x++) {
    const noise = rand() * 1000 - 500; // huge scale, zero correlation with the label
    features.push([x, noise]);
    labels.push(x > 0 ? 1 : 0);
  }

  const model = trainLogisticRegression(features, labels, { l2: 0.01 });

  assert.ok(Math.abs(model.weights[0]) > 1, 'the informative feature gets a real weight');
  assert.ok(
    Math.abs(model.weights[1]) < Math.abs(model.weights[0]) / 3,
    'the noise feature is weighted much less than the informative one despite its far larger raw scale',
  );
});

test('converges correctly even when feature scales differ by orders of magnitude', () => {
  // feature 0 in [-1, 1], feature 1 in [-5000, 5000] -- without internal
  // standardization, gradient descent at a shared learning rate would either
  // diverge on the large-scale feature or barely move the small-scale one.
  const features: number[][] = [];
  const labels: number[] = [];
  for (let x = -10; x <= 10; x++) {
    features.push([x / 10, x * 500]);
    labels.push(x > 0 ? 1 : 0);
  }

  const model = trainLogisticRegression(features, labels, { l2: 0 });

  assert.ok(predictProbability(model, [0.8, 400]) > 0.9);
  assert.ok(predictProbability(model, [-0.8, -400]) < 0.1);
});

test('logLoss is near zero for confident-and-correct predictions, high for confident-and-wrong', () => {
  const good = logLoss([0.99, 0.01, 0.98], [1, 0, 1]);
  const bad = logLoss([0.01, 0.99, 0.02], [1, 0, 1]);

  assert.ok(good < 0.1);
  assert.ok(bad > 3);
});

test('a coin-flip model (all predictions 0.5) scores log-loss of exactly ln(2)', () => {
  const loss = logLoss([0.5, 0.5, 0.5, 0.5], [1, 0, 1, 0]);
  assert.ok(Math.abs(loss - Math.log(2)) < 1e-9);
});
