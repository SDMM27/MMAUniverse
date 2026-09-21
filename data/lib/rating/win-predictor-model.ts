// data/lib/rating/win-predictor-model.ts
//
// The serialized shape of the trained win predictor (data/ml-models/
// win-predictor.json) and a loader that validates it against the current
// feature list, so a stale artifact from an older feature set fails loudly
// instead of silently producing garbage probabilities.
import fs from 'node:fs';
import type { LogisticRegressionModel } from './logistic-regression';
import { WIN_PREDICTOR_FEATURE_NAMES } from './win-predictor-features';

export type SerializedWinPredictor = LogisticRegressionModel & {
  featureNames: string[]; // embedded so a reader doesn't have to cross-reference WIN_PREDICTOR_FEATURE_NAMES
  trainedAt: string; // ISO timestamp
  exampleCount: number;
  holdoutAccuracy: number; // chronological 80/20 sanity-check numbers, kept for reference
  holdoutLogLoss: number;
};

/** Throws if the model's feature names/lengths don't match the current WIN_PREDICTOR_FEATURE_NAMES. */
export function validateWinPredictor(model: SerializedWinPredictor): SerializedWinPredictor {
  const dims = WIN_PREDICTOR_FEATURE_NAMES.length;
  const sameNames =
    model.featureNames.length === dims && model.featureNames.every((name, i) => name === WIN_PREDICTOR_FEATURE_NAMES[i]);
  if (!sameNames || model.weights.length !== dims || model.featureMeans.length !== dims || model.featureStds.length !== dims) {
    throw new Error('win-predictor.json does not match the current feature list -- re-run `npm run train:win-predictor`.');
  }
  return model;
}

export function loadWinPredictor(modelPath: string): SerializedWinPredictor {
  if (!fs.existsSync(modelPath)) {
    throw new Error(`${modelPath} not found -- run \`npm run train:win-predictor\` first.`);
  }
  return validateWinPredictor(JSON.parse(fs.readFileSync(modelPath, 'utf-8')) as SerializedWinPredictor);
}
