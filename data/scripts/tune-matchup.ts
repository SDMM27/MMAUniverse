// data/scripts/tune-matchup.ts
//
// `npm run tune:matchup`: fits and validates the fight simulator's matchup
// layer (data/lib/rating/matchup-model.ts). Replays every UFC fight in date
// order: the pre-fight odds exactly as the simulator computes them
// (predictFight on the Glicko career simulation of compute-fighter-ratings),
// each fighter's age on fight night, and their UFCStats career sums from
// fights strictly before that date. Corner A is the lower fighter id, so who
// won never decides the orientation.
//   - veteranAge is picked, and the weights fitted, on fights before the most
//     recent TEST_SHARE; the held-out fights are reported against the rating
//     alone and the age-only layer,
//   - the same fit is repeated on four time windows, so a gain that only
//     shows up once is visible as such,
//   - the shipped weights are refit on every fight and written to
//     data/ml-models/fight-matchup-model.json.
// Read-only against Neon.
import fs from 'node:fs';
import path from 'node:path';
import { simulateCareerRatings } from '../lib/rating/simulate-career';
import { DEFAULT_GLICKO_PARAMS } from '../lib/rating/glicko-rating';
import { loadProspectPrior } from './prospect-data';
import type { MatchupModel, MatchupTerm } from '../lib/rating/matchup-model';
import { attachRatings, fit, line, loadMatchupData, metrics, testFromDateOf, windowMetrics, withModel, type Sample } from './matchup-tuning';

const OUTPUT_FILE = path.resolve('data/ml-models/fight-matchup-model.json');
const VETERAN_AGES = [29, 30, 31, 32, 33, 34, 35];
const AGE_TERMS: MatchupTerm[] = ['rating', 'age', 'veteran'];

async function loadSamples(): Promise<Sample[]> {
  const { fights, noResults, contexts } = await loadMatchupData();
  return attachRatings(contexts, simulateCareerRatings(fights, noResults, DEFAULT_GLICKO_PARAMS, await loadProspectPrior()).history);
}

async function main() {
  const samples = await loadSamples();
  const testFromDate = testFromDateOf(samples);
  const train = samples.filter((s) => s.date < testFromDate);
  const test = samples.filter((s) => s.date >= testFromDate);
  console.log(`${samples.length} decided UFC fights. Training before ${testFromDate} (${train.length}), testing from it (${test.length}).\n`);

  let best: { model: MatchupModel; logLoss: number } | null = null;
  for (const veteranAge of VETERAN_AGES) {
    const model = fit(train, veteranAge);
    const { logLoss } = metrics(train, withModel(model));
    console.log(`  veteranAge ${veteranAge}: train log-loss ${logLoss.toFixed(4)}`);
    if (!best || logLoss < best.logLoss) best = { model, logLoss };
  }
  const { veteranAge } = best!.model;

  const report = {
    count: test.length,
    ratingAlone: metrics(test, (s) => s.ratingWinA),
    ageOnly: metrics(test, withModel(fit(train, veteranAge, AGE_TERMS))),
    full: metrics(test, withModel(best!.model)),
  };
  console.log(`\nTrained weights: ${JSON.stringify(best!.model.weights)}`);
  console.log(`\nHeld-out (${report.count} fights from ${testFromDate}):`);
  line('predictFight', report.ratingAlone);
  line('+ age (previous layer)', report.ageOnly);
  line('+ every factor', report.full);

  console.log('\nSame comparison, trained before each window and tested inside it:');
  const ageOnlyWindows = windowMetrics(samples, veteranAge, AGE_TERMS);
  const fullWindows = windowMetrics(samples, veteranAge);
  const windows = fullWindows.map(({ from, to, count, ...full }, i) => {
    const ageOnly = { logLoss: ageOnlyWindows[i].logLoss, accuracy: ageOnlyWindows[i].accuracy };
    console.log(
      `  ${from} -> ${to.slice(0, 4) === '9999' ? 'today' : to}  (${count})  log-loss ${ageOnly.logLoss.toFixed(4)} -> ${full.logLoss.toFixed(4)}   accuracy ${(ageOnly.accuracy * 100).toFixed(1)}% -> ${(full.accuracy * 100).toFixed(1)}%`,
    );
    return { from, to, count, ageOnly, full };
  });

  const shipped = fit(samples, veteranAge);
  console.log(`\nShipped weights (all fights): ${JSON.stringify(shipped.weights)}`);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify({ tunedAt: new Date().toISOString(), testFromDate, heldOut: report, windows, model: shipped }, null, 2) + '\n');
  console.log(`Wrote ${path.relative(process.cwd(), OUTPUT_FILE)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
