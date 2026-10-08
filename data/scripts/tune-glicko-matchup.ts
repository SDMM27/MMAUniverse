// data/scripts/tune-glicko-matchup.ts
//
// `npm run tune:glicko-matchup`: re-tunes the Glicko constants for what the
// fight simulator actually shows -- the matchup layer's odds on top of the
// rating -- instead of the rating alone (tune-glicko). Since the layer took
// over age, form and style, the rating's best settings may have moved: the
// layer already scales the Glicko odds down (rating weight 0.56).
//
// For each candidate set of constants: replay every UFC career, refit the
// matchup layer on the oldest 80% of fights, and score it there (the search
// objective); the most recent 20% and the four windows of tune-matchup judge
// the result. Two searches:
//   - ranking-safe: winScoreFloor stays at its shipped value, chosen for the
//     ranking fans see (see DEFAULT_GLICKO_PARAMS), not for log-loss,
//   - free: winScoreFloor searched too, for reference only.
// The same Glicko also produces the FightScore ranking, so nothing is promoted
// here: the candidates are written to data/ml-models/glicko-matchup-params.json,
// to be checked with `npm run check:ratings -- --params '<json>'` and copied
// into DEFAULT_GLICKO_PARAMS by hand. Read-only against Neon.
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_GLICKO_PARAMS, type GlickoParams } from '../lib/rating/glicko-rating';
import { simulateCareerRatings } from '../lib/rating/simulate-career';
import { loadProspectPrior } from './prospect-data';
import { patternSearch, type ParamSearchSpace } from '../lib/rating/point-flow-tuning';
import { MATCHUP_MODEL } from '../lib/rating/matchup-model-tuned';
import { attachRatings, fit, line, loadMatchupData, metrics, testFromDateOf, windowMetrics, withModel, type MatchupContext } from './matchup-tuning';
import type { CareerFightInput, CareerNoResultInput } from '../lib/rating/simulate-career';

const OUTPUT_FILE = path.resolve('data/ml-models/glicko-matchup-params.json');
const MAX_EVALUATIONS = 400;

// Same space as tune-glicko. initialRating only anchors the scale, conservativeRdMultiplier only sorts the ranking.
const SEARCH_SPACE: ParamSearchSpace<GlickoParams> = {
  initialRd: { min: 80, max: 500, kind: 'linear', step: 40 },
  rdPerMonth: { min: 0, max: 80, kind: 'linear', step: 8 },
  rdOnDivisionChange: { min: 0, max: 250, kind: 'linear', step: 25 },
  carryOverShare: { min: 0.3, max: 1, kind: 'linear', step: 0.1 },
  winScoreFloor: { min: 0.5, max: 1, kind: 'linear', step: 0.1 },
  minRd: { min: 10, max: 150, kind: 'linear', step: 20 },
};
const { winScoreFloor: _floor, ...RANKING_SAFE_SPACE } = SEARCH_SPACE;

type Data = { fights: CareerFightInput[]; noResults: CareerNoResultInput[]; contexts: MatchupContext[]; initialRatingOf: (fighterId: number, debutDateIso: string) => number };

function evaluate(data: Data, params: GlickoParams, testFromDate: string, veteranAge: number) {
  const samples = attachRatings(data.contexts, simulateCareerRatings(data.fights, data.noResults, params, data.initialRatingOf).history);
  const train = samples.filter((s) => s.date < testFromDate);
  const test = samples.filter((s) => s.date >= testFromDate);
  const model = fit(train, veteranAge);
  return {
    samples,
    train: metrics(train, withModel(model)),
    test: metrics(test, withModel(model)),
    ratingAloneTest: metrics(test, (s) => s.ratingWinA),
    ratingWeight: model.weights.rating,
  };
}

function search(data: Data, space: ParamSearchSpace<GlickoParams>, label: string, testFromDate: string, veteranAge: number): GlickoParams {
  console.log(`\n${label}:`);
  const startedAt = Date.now();
  const objective = (params: GlickoParams) => evaluate(data, params, testFromDate, veteranAge).train.logLoss;
  const result = patternSearch<GlickoParams>(objective, DEFAULT_GLICKO_PARAMS, space, {
    refinements: 3,
    maxEvaluations: MAX_EVALUATIONS,
    onImprove: (key, value, score) => console.log(`  ${String(key).padEnd(20)} -> ${Number(value).toPrecision(4).padEnd(8)} train log-loss ${score.toFixed(5)}`),
  });
  console.log(`  ${result.evaluations} evaluations in ${((Date.now() - startedAt) / 1000).toFixed(0)} s.`);

  // Readable values (2 significant digits) when that costs (almost) nothing on train.
  let tuned = { ...result.params };
  let tunedObjective = result.objective;
  for (const key of Object.keys(space) as (keyof GlickoParams)[]) {
    const rounded = Number(tuned[key].toPrecision(2));
    if (rounded === tuned[key]) continue;
    const candidate = { ...tuned, [key]: rounded };
    const score = objective(candidate);
    if (score <= tunedObjective + 0.0002) {
      tuned = candidate;
      tunedObjective = Math.min(score, tunedObjective);
    }
  }
  return tuned;
}

async function main() {
  // Debutants start from their pre-UFC record, as the shipped ratings do (data/lib/rating/prospect-rating.ts).
  const data = { ...(await loadMatchupData()), initialRatingOf: await loadProspectPrior() };
  const { veteranAge } = MATCHUP_MODEL;
  const testFromDate = testFromDateOf(data.contexts);
  console.log(`${data.contexts.length} decided UFC fights. Tuning on fights before ${testFromDate}, testing from it. veteranAge ${veteranAge} (shipped layer).`);

  const rankingSafe = search(data, RANKING_SAFE_SPACE, `Ranking-safe search (winScoreFloor stays ${DEFAULT_GLICKO_PARAMS.winScoreFloor})`, testFromDate, veteranAge);
  const free = search(data, SEARCH_SPACE, 'Free search (winScoreFloor too, for reference)', testFromDate, veteranAge);

  const report = (params: GlickoParams) => {
    const { samples, ...result } = evaluate(data, params, testFromDate, veteranAge);
    return { params, ...result, windows: windowMetrics(samples, veteranAge) };
  };
  const candidates = { shipped: report(DEFAULT_GLICKO_PARAMS), rankingSafe: report(rankingSafe), free: report(free) };

  console.log('\nConstant              shipped    ranking-safe  free');
  for (const key of Object.keys(SEARCH_SPACE) as (keyof GlickoParams)[]) {
    const spec = SEARCH_SPACE[key]!;
    const bound = (v: number) => (v === spec.min ? ' (min)' : v === spec.max ? ' (max)' : '');
    console.log(`  ${String(key).padEnd(20)} ${String(DEFAULT_GLICKO_PARAMS[key]).padEnd(10)} ${(rankingSafe[key] + bound(rankingSafe[key])).padEnd(13)} ${free[key]}${bound(free[key])}`);
  }

  console.log(`\nHeld-out (${testFromDate} onward), simulator odds = Glicko + matchup layer refit on the train fights:`);
  for (const [label, c] of Object.entries(candidates)) {
    line(`${label}, simulator`, c.test);
    line(`${label}, Glicko alone`, c.ratingAloneTest);
    console.log(`  ${''.padEnd(30)} rating weight in the layer ${c.ratingWeight.toFixed(3)}`);
  }

  console.log('\nSimulator log-loss, trained before each window and tested inside it (shipped -> ranking-safe -> free):');
  candidates.shipped.windows.forEach((w, i) => {
    const values = [candidates.shipped, candidates.rankingSafe, candidates.free].map((c) => c.windows[i].logLoss.toFixed(4));
    console.log(`  ${w.from} -> ${w.to.slice(0, 4) === '9999' ? 'today' : w.to}  (${w.count})  ${values.join(' -> ')}`);
  });

  const changed = (params: GlickoParams) =>
    JSON.stringify(Object.fromEntries((Object.keys(SEARCH_SPACE) as (keyof GlickoParams)[]).filter((k) => params[k] !== DEFAULT_GLICKO_PARAMS[k]).map((k) => [k, params[k]])));
  console.log(`\nCheck the ranking before promoting anything:\n  npm run check:ratings -- --params '${changed(rankingSafe)}'`);

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify({ tunedAt: new Date().toISOString(), testFromDate, veteranAge, ...candidates }, null, 2) + '\n');
  console.log(`\nWrote ${path.relative(process.cwd(), OUTPUT_FILE)}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
