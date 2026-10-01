// data/lib/rating/logistic-regression.ts
//
// Hand-rolled binary logistic regression (batch gradient descent + L2) --
// no heavy ML dependency needed, the dataset is small enough. This is the
// trained-model half of FightScore v2 (see
// docs/superpowers/specs/2026-09-14-fighter-rating-algorithm-design.md,
// "Roadmap v2"): predicts P(fighter A beats fighter B) from a feature-
// differential vector (points, streak, style-stat rates, ...), to check
// whether it adds predictive lift on top of the point-flow engine's own
// points differential -- the point-flow engine itself stays an explicit
// formula, not a trained model (see data/scripts/prototype-ml-rating.ts for
// the real-data evaluation this exists to support).

export type LogisticRegressionModel = {
  weights: number[];
  bias: number;
  // z-score standardization stats, fit on the TRAINING set only, and reused
  // (not refit) at predict time so a caller can't accidentally leak test-set
  // statistics into the model.
  featureMeans: number[];
  featureStds: number[];
};

export type TrainOptions = {
  learningRate?: number;
  iterations?: number;
  l2?: number; // L2 penalty strength, 0 disables regularization
};

function standardize(features: number[][], means: number[], stds: number[]): number[][] {
  return features.map((row) => row.map((v, d) => (stds[d] < 1e-9 ? 0 : (v - means[d]) / stds[d])));
}

function computeMeansAndStds(features: number[][]): { means: number[]; stds: number[] } {
  const n = features.length;
  const dims = features[0].length;
  const means = new Array(dims).fill(0);
  for (const row of features) row.forEach((v, d) => (means[d] += v));
  for (let d = 0; d < dims; d++) means[d] /= n;

  const variances = new Array(dims).fill(0);
  for (const row of features) row.forEach((v, d) => (variances[d] += (v - means[d]) ** 2));
  const stds = variances.map((v) => Math.sqrt(v / n));

  return { means, stds };
}

function sigmoid(z: number): number {
  if (z >= 0) {
    const e = Math.exp(-z);
    return 1 / (1 + e);
  }
  const e = Math.exp(z);
  return e / (1 + e);
}

/**
 * Trains a binary logistic regression classifier via batch gradient descent
 * on L2-regularized cross-entropy loss. `features` rows are standardized
 * internally (z-score, fit on this training call) before fitting, since the
 * real feature set (see prototype-ml-rating.ts) mixes wildly different
 * scales (points ~0-30 vs strike-count differentials in the hundreds) that
 * would otherwise make gradient descent converge unevenly across dimensions.
 * `labels` must be 0/1, same length as `features`.
 */
export function trainLogisticRegression(
  features: number[][],
  labels: number[],
  options: TrainOptions = {},
): LogisticRegressionModel {
  if (features.length === 0) throw new Error('trainLogisticRegression requires at least one example');
  if (features.length !== labels.length) throw new Error('features and labels must have the same length');

  const { learningRate = 0.1, iterations = 2000, l2 = 0.01 } = options;
  const { means, stds } = computeMeansAndStds(features);
  const standardized = standardize(features, means, stds);

  const dims = standardized[0].length;
  const n = standardized.length;
  let weights = new Array(dims).fill(0);
  let bias = 0;

  for (let iter = 0; iter < iterations; iter++) {
    const weightGradients = new Array(dims).fill(0);
    let biasGradient = 0;

    for (let i = 0; i < n; i++) {
      const row = standardized[i];
      let z = bias;
      for (let d = 0; d < dims; d++) z += weights[d] * row[d];
      const prediction = sigmoid(z);
      const error = prediction - labels[i];

      for (let d = 0; d < dims; d++) weightGradients[d] += error * row[d];
      biasGradient += error;
    }

    for (let d = 0; d < dims; d++) {
      const regularization = l2 * weights[d];
      weights[d] -= learningRate * (weightGradients[d] / n + regularization);
    }
    bias -= learningRate * (biasGradient / n);
  }

  return { weights, bias, featureMeans: means, featureStds: stds };
}

/** Predicts P(label = 1) for one feature vector, standardizing it with the model's own training-set means/stds. */
export function predictProbability(model: LogisticRegressionModel, featureVector: number[]): number {
  const standardized = featureVector.map((v, d) =>
    model.featureStds[d] < 1e-9 ? 0 : (v - model.featureMeans[d]) / model.featureStds[d],
  );
  let z = model.bias;
  for (let d = 0; d < standardized.length; d++) z += model.weights[d] * standardized[d];
  return sigmoid(z);
}

/** Binary cross-entropy (log-loss) of a model's predictions against real 0/1 labels -- lower is better, 0 is a perfect model. Clamps predictions away from exactly 0/1 to avoid -Infinity from a single confidently-wrong example. */
export function logLoss(predictions: number[], labels: number[]): number {
  const EPSILON = 1e-12;
  let sum = 0;
  for (let i = 0; i < predictions.length; i++) {
    const p = Math.min(1 - EPSILON, Math.max(EPSILON, predictions[i]));
    sum += labels[i] * Math.log(p) + (1 - labels[i]) * Math.log(1 - p);
  }
  return -sum / predictions.length;
}
