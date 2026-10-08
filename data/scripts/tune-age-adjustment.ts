// data/scripts/tune-age-adjustment.ts
//
// `npm run tune:age`: fits and validates the fight simulator's age layer
// (data/lib/rating/age-adjustment.ts). Replays every UFC fight through the
// same Glicko career simulation as compute-fighter-ratings, reads each
// fight's pre-fight odds exactly as the simulator computes them
// (predictFight), and each fighter's age on fight night from
// fighters.birth_date. Corner A is the lower fighter id, so who won never
// decides the orientation.
//   - veteranAge is picked, and the weights fitted, on fights before the most
//     recent TEST_SHARE,
//   - the held-out fights are reported against the rating alone,
//   - the shipped weights are refit on every fight and written to
//     data/ml-models/fight-age-model.json.
// Read-only against Neon.
import fs from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';
import { loadData, loadEnvLocal, toCareerInputs } from './tuning-data';
import { simulateCareerRatings } from '../lib/rating/simulate-career';
import { predictFight } from '../lib/rating/simulate-fight';
import { ageFeatures, fitAgeAdjustment, scoreFeatures, type AgeAdjustmentModel } from '../lib/rating/age-adjustment';

const OUTPUT_FILE = path.resolve('data/ml-models/fight-age-model.json');
const TEST_SHARE = 0.2;
const VETERAN_AGES = [30, 31, 32, 33, 34, 35];

type Sample = { date: string; ratingWinA: number; ageA: number | null; ageB: number | null; aWon: boolean };

const yearsBetween = (fromIso: string, toIso: string) => (Date.parse(toIso) - Date.parse(fromIso)) / (365.25 * 86400e3);

async function loadSamples(): Promise<Sample[]> {
  const { fights, noResults } = toCareerInputs(await loadData());
  const { history } = simulateCareerRatings(fights, noResults);

  loadEnvLocal();
  const sql = neon(process.env.DATABASE_URL!);
  // As text: the driver turns a DATE into a local-midnight Date (see fighter-physique notes).
  const rows = (await sql`SELECT id, birth_date::text AS birth_date FROM fighters WHERE birth_date IS NOT NULL`) as { id: number; birth_date: string }[];
  const birth = new Map(rows.map((r) => [r.id, r.birth_date]));
  const ageOn = (id: number, date: string) => (birth.has(id) ? yearsBetween(birth.get(id)!, date) : null);

  return history.map((e) => {
    const aIsWinner = e.winnerId < e.loserId;
    const [a, b] = aIsWinner ? [e.winnerBefore, e.loserBefore] : [e.loserBefore, e.winnerBefore];
    const [idA, idB] = aIsWinner ? [e.winnerId, e.loserId] : [e.loserId, e.winnerId];
    return { date: e.eventDate, ratingWinA: predictFight(a, b).winA, ageA: ageOn(idA, e.eventDate), ageB: ageOn(idB, e.eventDate), aWon: aIsWinner };
  });
}

const toFit = (samples: Sample[], veteranAge: number) =>
  samples.map((s) => ({ features: ageFeatures(s.ratingWinA, s.ageA, s.ageB, veteranAge), aWon: s.aWon }));

function metrics(samples: Sample[], predict: (s: Sample) => number) {
  let logLoss = 0;
  let correct = 0;
  for (const s of samples) {
    const p = predict(s);
    logLoss -= Math.log(Math.max(s.aWon ? p : 1 - p, 1e-12));
    correct += p === 0.5 ? 0.5 : (p > 0.5) === s.aWon ? 1 : 0;
  }
  return { logLoss: logLoss / samples.length, accuracy: correct / samples.length };
}

const withAge = (model: AgeAdjustmentModel) => (s: Sample) => scoreFeatures(ageFeatures(s.ratingWinA, s.ageA, s.ageB, model.veteranAge), model);
const ratingOnly = (model: AgeAdjustmentModel) => (s: Sample) => scoreFeatures({ ...ageFeatures(s.ratingWinA, null, null, 0) }, model);

async function main() {
  const samples = await loadSamples();
  const dates = samples.map((s) => s.date).sort();
  const testFromDate = dates[Math.floor(dates.length * (1 - TEST_SHARE))];
  const train = samples.filter((s) => s.date < testFromDate);
  const test = samples.filter((s) => s.date >= testFromDate);
  const known = (list: Sample[]) => list.filter((s) => s.ageA != null && s.ageB != null).length;
  console.log(`${samples.length} decided UFC fights. Training before ${testFromDate} (${train.length}, both ages known ${known(train)}), testing from it (${test.length}, ${known(test)}).\n`);

  let best: { model: AgeAdjustmentModel; logLoss: number } | null = null;
  for (const veteranAge of VETERAN_AGES) {
    const model = fitAgeAdjustment(toFit(train, veteranAge), veteranAge);
    const { logLoss } = metrics(train, withAge(model));
    console.log(`  veteranAge ${veteranAge}: train log-loss ${logLoss.toFixed(4)}`);
    if (!best || logLoss < best.logLoss) best = { model, logLoss };
  }
  const trained = best!.model;
  const calibratedOnly = fitAgeAdjustment(toFit(train, trained.veteranAge).map((s) => ({ ...s, features: { ...s.features, ageGap: 0, veteran: 0 } })), trained.veteranAge);

  const report = {
    count: test.length,
    ratingAlone: metrics(test, (s) => s.ratingWinA),
    calibratedRating: metrics(test, ratingOnly(calibratedOnly)),
    withAge: metrics(test, withAge(trained)),
  };
  const line = (label: string, m: { logLoss: number; accuracy: number }) =>
    console.log(`  ${label.padEnd(24)} log-loss ${m.logLoss.toFixed(4)}   accuracy ${(m.accuracy * 100).toFixed(1)}%`);
  console.log(`\nTrained weights: ${JSON.stringify(trained)}`);
  console.log(`\nHeld-out (${report.count} fights from ${testFromDate}):`);
  line('predictFight', report.ratingAlone);
  line('recalibrated rating', report.calibratedRating);
  line('+ age', report.withAge);

  const shipped = fitAgeAdjustment(toFit(samples, trained.veteranAge), trained.veteranAge);
  console.log(`\nShipped weights (all fights): ${JSON.stringify(shipped)}`);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify({ tunedAt: new Date().toISOString(), testFromDate, heldOut: report, model: shipped }, null, 2) + '\n');
  console.log(`Wrote ${path.relative(process.cwd(), OUTPUT_FILE)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
