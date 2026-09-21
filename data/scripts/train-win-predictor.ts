// data/scripts/train-win-predictor.ts
//
// Trains the FightScore win predictor -- see docs/superpowers/plans/
// 2026-09-16-fightscore-win-predictor.md, Task 2. Builds the same examples as
// the prototype (data/scripts/win-predictor-dataset.ts), logs a chronological
// 80/20 holdout accuracy/log-loss as a sanity check, then retrains on 100% of
// the examples for the artifact that ships (no further decision left to
// validate, so more data is better) and writes data/ml-models/win-predictor.json.
// I/O orchestration, verified manually against real data. Run with
// `npm run train:win-predictor`. Retraining is manual/periodic, not in CI.
import fs from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';
import { WIN_PREDICTOR_FEATURE_NAMES } from '../lib/rating/win-predictor-features';
import { trainLogisticRegression, predictProbability, logLoss } from '../lib/rating/logistic-regression';
import type { SerializedWinPredictor } from '../lib/rating/win-predictor-model';
import { loadWinPredictorExamples } from './win-predictor-dataset';

function loadEnvLocal() {
  const envPath = path.resolve('.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvLocal();
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set (expected in .env.local)');
  process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);

const MODEL_PATH = path.resolve('data/ml-models/win-predictor.json');

async function main() {
  const { examples, divisionCount } = await loadWinPredictorExamples(sql);
  console.log(`Built ${examples.length} training examples across ${divisionCount} divisions.`);

  // Sanity check: chronological 80/20 holdout (same split as the prototype).
  const splitIndex = Math.floor(examples.length * 0.8);
  const train = examples.slice(0, splitIndex);
  const test = examples.slice(splitIndex);
  const holdoutModel = trainLogisticRegression(train.map((e) => e.features), train.map((e) => e.label));
  const holdoutPreds = test.map((e) => predictProbability(holdoutModel, e.features));
  const holdoutAccuracy = holdoutPreds.filter((p, i) => (p >= 0.5 ? 1 : 0) === test[i].label).length / test.length;
  const holdoutLogLoss = logLoss(holdoutPreds, test.map((e) => e.label));
  console.log(
    `Holdout (train up to ${train[train.length - 1].eventDate}, test from ${test[0].eventDate}, ${test.length} fights): ` +
      `accuracy ${(holdoutAccuracy * 100).toFixed(1)}%, log-loss ${holdoutLogLoss.toFixed(4)} (coin flip: ${Math.log(2).toFixed(4)})`,
  );

  // The shipped model: 100% of the examples.
  const finalModel = trainLogisticRegression(examples.map((e) => e.features), examples.map((e) => e.label));
  const serialized: SerializedWinPredictor = {
    ...finalModel,
    featureNames: WIN_PREDICTOR_FEATURE_NAMES,
    trainedAt: new Date().toISOString(),
    exampleCount: examples.length,
    holdoutAccuracy,
    holdoutLogLoss,
  };
  fs.mkdirSync(path.dirname(MODEL_PATH), { recursive: true });
  fs.writeFileSync(MODEL_PATH, JSON.stringify(serialized, null, 2) + '\n');
  console.log(`Wrote ${MODEL_PATH} (${examples.length} examples, ${finalModel.weights.length} weights).`);

  console.log('\nFinal model coefficients (standardized -- magnitude = relative importance):');
  const ranked = WIN_PREDICTOR_FEATURE_NAMES.map((name, i) => ({ name, weight: finalModel.weights[i] })).sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
  for (const { name, weight } of ranked) {
    console.log(`  ${name.padEnd(28)} ${weight >= 0 ? '+' : ''}${weight.toFixed(3)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
