// data/scripts/compare-win-predictor.ts
//
// Dry run: does the new dominance (split/majority penalty + UFC bonuses) change how well
// the win predictor does? Trains it twice on the same fights -- old dominance, new
// dominance -- with the train-win-predictor.ts holdout (chronological 80/20) and prints
// accuracy / log-loss. Writes NOTHING (no model file, read-only Neon).
import { neon } from '@neondatabase/serverless';
import { trainLogisticRegression, predictProbability, logLoss } from '../lib/rating/logistic-regression';
import { loadEnvLocal } from './tuning-data';
import { loadWinPredictorExamples } from './win-predictor-dataset';

loadEnvLocal();
const sql = neon(process.env.DATABASE_URL!);

async function evaluate(label: string, legacyDominance: boolean) {
  const { examples } = await loadWinPredictorExamples(sql, legacyDominance);
  const split = Math.floor(examples.length * 0.8);
  const train = examples.slice(0, split);
  const test = examples.slice(split);
  const model = trainLogisticRegression(train.map((e) => e.features), train.map((e) => e.label));
  const preds = test.map((e) => predictProbability(model, e.features));
  const correct = preds.filter((p, i) => (p >= 0.5 ? 1 : 0) === test[i].label).length;
  console.log(`${label}: ${test.length} test fights (from ${test[0].eventDate}), accuracy ${((correct / test.length) * 100).toFixed(2)}% (${correct}/${test.length}), log-loss ${logLoss(preds, test.map((e) => e.label)).toFixed(4)}`);
}

async function main() {
  await evaluate('ancienne dominance', true);
  await evaluate('nouvelle dominance', false);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
