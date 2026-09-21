import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWinPredictor, type SerializedWinPredictor } from './win-predictor-model';
import { WIN_PREDICTOR_FEATURE_NAMES } from './win-predictor-features';

const valid = (): SerializedWinPredictor => {
  const n = WIN_PREDICTOR_FEATURE_NAMES.length;
  return {
    weights: new Array(n).fill(0.1),
    bias: 0,
    featureMeans: new Array(n).fill(0),
    featureStds: new Array(n).fill(1),
    featureNames: [...WIN_PREDICTOR_FEATURE_NAMES],
    trainedAt: '2026-01-01T00:00:00.000Z',
    exampleCount: 10,
    holdoutAccuracy: 0.57,
    holdoutLogLoss: 0.68,
  };
};

test('validateWinPredictor accepts a model matching the current feature list', () => {
  const model = valid();
  assert.equal(validateWinPredictor(model), model);
});

test('validateWinPredictor rejects a model with a different feature order or length', () => {
  const reordered = valid();
  [reordered.featureNames[0], reordered.featureNames[1]] = [reordered.featureNames[1], reordered.featureNames[0]];
  assert.throws(() => validateWinPredictor(reordered), /re-run/);

  const shortWeights = valid();
  shortWeights.weights.pop();
  assert.throws(() => validateWinPredictor(shortWeights), /re-run/);
});
