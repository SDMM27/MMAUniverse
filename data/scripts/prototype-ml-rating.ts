// data/scripts/prototype-ml-rating.ts
//
// FightScore v2 exploration -- see docs/superpowers/specs/
// 2026-09-14-fighter-rating-algorithm-design.md, "Roadmap v2": before
// investing in a spec/plan for a trained model, empirically check whether
// one actually adds predictive lift on top of the point-flow engine's own
// points differential. Not wired into any batch job, doesn't write to the
// DB -- read-only exploration. Run with `npm run explore:ml-rating`.
//
// Approach: walk every UFC division chronologically (same pairing/grouping
// as compute-fighter-ratings.ts), and for each fight, snapshot each
// fighter's state strictly BEFORE that fight -- point-flow points (via
// simulateDivisionRatings, already point-in-time-correct), streak,
// former-champion flag, and per-15-min style-stat rates accumulated only
// from that fighter's earlier fights in this division. Build one training
// example per fight with a fixed 50/50 fighterA/fighterB split (feature =
// A - B, label = 1 if A won) so the model can't cheat by learning "the
// example is always constructed from the winner's side". Then a
// chronological train/test split (earliest 80% / most recent 20%) so
// evaluation reflects "would this have worked on real future fights", not a
// random split that mixes past and future.
//
// Compares three predictors on the held-out test set:
//   1. naive: sign(pointsDiff) -- does the existing point-flow score alone
//      already pick the winner, no model at all?
//   2. points-only logistic regression -- same single feature, but lets a
//      trained model find a probability curve/threshold instead of a raw sign.
//   3. full logistic regression -- points + streak + former-champion + all
//      style-stat-rate differentials.
// If (3) doesn't clearly beat (1)/(2), the style features aren't adding
// real signal yet and a production trained model isn't worth building on
// top of this feature set as-is.
import fs from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';
import { WIN_PREDICTOR_FEATURE_NAMES as FEATURE_NAMES } from '../lib/rating/win-predictor-features';
import { loadWinPredictorExamples } from './win-predictor-dataset';
import { trainLogisticRegression, predictProbability, logLoss } from '../lib/rating/logistic-regression';

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

async function main() {
  const { examples, divisionCount } = await loadWinPredictorExamples(sql);
  console.log(`Built ${examples.length} training examples across ${divisionCount} divisions.`);

  const splitIndex = Math.floor(examples.length * 0.8);
  const train = examples.slice(0, splitIndex);
  const test = examples.slice(splitIndex);
  console.log(`Chronological split: ${train.length} train (up to ${train[train.length - 1].eventDate}), ${test.length} test (from ${test[0].eventDate}).`);

  // 1. Naive baseline: sign(pointsDiff), no training at all.
  let naiveCorrect = 0;
  for (const ex of test) {
    const predictedA = ex.features[0] > 0 ? 1 : 0;
    if (predictedA === ex.label) naiveCorrect++;
  }
  console.log(`\n1. Naive sign(pointsDiff): accuracy ${(naiveCorrect / test.length * 100).toFixed(1)}%`);

  // 2. Points-only logistic regression.
  const pointsOnlyModel = trainLogisticRegression(train.map((e) => [e.features[0]]), train.map((e) => e.label));
  const pointsOnlyPreds = test.map((e) => predictProbability(pointsOnlyModel, [e.features[0]]));
  const pointsOnlyAccuracy = pointsOnlyPreds.filter((p, i) => (p >= 0.5 ? 1 : 0) === test[i].label).length / test.length;
  console.log(`2. Points-only logistic regression: accuracy ${(pointsOnlyAccuracy * 100).toFixed(1)}%, log-loss ${logLoss(pointsOnlyPreds, test.map((e) => e.label)).toFixed(4)}`);

  // 3. Full model: points + streak + former-champion + style-stat rates.
  const fullModel = trainLogisticRegression(train.map((e) => e.features), train.map((e) => e.label));
  const fullPreds = test.map((e) => predictProbability(fullModel, e.features));
  const fullAccuracy = fullPreds.filter((p, i) => (p >= 0.5 ? 1 : 0) === test[i].label).length / test.length;
  console.log(`3. Full logistic regression (${FEATURE_NAMES.length} features): accuracy ${(fullAccuracy * 100).toFixed(1)}%, log-loss ${logLoss(fullPreds, test.map((e) => e.label)).toFixed(4)}`);

  console.log(`\nCoin-flip reference log-loss: ${Math.log(2).toFixed(4)}\n`);

  console.log('Full model coefficients (standardized -- magnitude = relative importance):');
  const ranked = FEATURE_NAMES.map((name, i) => ({ name, weight: fullModel.weights[i] })).sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
  for (const { name, weight } of ranked) {
    console.log(`  ${name.padEnd(28)} ${weight >= 0 ? '+' : ''}${weight.toFixed(3)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
