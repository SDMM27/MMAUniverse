// data/scripts/tune-glicko.ts
//
// Chooses the FightScore v2 Glicko constants (data/lib/rating/glicko-rating.ts)
// by measurement, the same way tune-point-flow.ts does for the point flow:
// log-loss of the pre-fight rating gap on the oldest 80% of fights, judged on
// the most recent 20%. Also re-scores the shipped point flow on the same
// held-out fights, so the comparison is always like for like. Writes
// data/ml-models/glicko-params.json; promoting the candidate into
// DEFAULT_GLICKO_PARAMS stays a manual, reviewed step. Read-only against
// Neon. Run with `npm run tune:glicko` (`--refresh` to re-fetch the fights).
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_GLICKO_PARAMS, type GlickoParams } from '../lib/rating/glicko-rating';
import { collectCareerRatingDiffs } from '../lib/rating/glicko-tuning';
import { collectWinnerLogRatios, evaluateLogRatios, fitScale, patternSearch, type ParamSearchSpace } from '../lib/rating/point-flow-tuning';
import { DEFAULT_POINT_FLOW_PARAMS } from '../lib/rating/point-flow';
import { loadData, toCareerInputs } from './tuning-data';
import { loadProspectPrior } from './prospect-data';

const OUTPUT_FILE = path.resolve('data/ml-models/glicko-params.json');
const TEST_SHARE = 0.2;

// initialRating is not searched: it only anchors the scale.
const SEARCH_SPACE: ParamSearchSpace<GlickoParams> = {
  initialRd: { min: 80, max: 500, kind: 'linear', step: 40 },
  rdPerMonth: { min: 0, max: 80, kind: 'linear', step: 8 },
  rdOnDivisionChange: { min: 0, max: 250, kind: 'linear', step: 25 },
  carryOverShare: { min: 0.3, max: 1, kind: 'linear', step: 0.1 },
  winScoreFloor: { min: 0.5, max: 1, kind: 'linear', step: 0.1 },
  minRd: { min: 10, max: 150, kind: 'linear', step: 20 },
};

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

async function main() {
  const data = await loadData();
  // Debutants start from their pre-UFC record, as the shipped ratings do (data/lib/rating/prospect-rating.ts).
  const initialRatingOf = await loadProspectPrior();
  const { fights, noResults } = toCareerInputs(data);
  const dates = fights.map((f) => f.eventDate);
  const testFromDate = dates[Math.floor(dates.length * (1 - TEST_SHARE))];
  console.log(`${fights.length} fights. Tuning on fights before ${testFromDate}, testing on ${testFromDate} onward.\n`);

  const pointFlow = collectWinnerLogRatios(data.divisions, DEFAULT_POINT_FLOW_PARAMS, testFromDate);
  const pointFlowScale = fitScale(pointFlow.train);
  const pointFlowTest = evaluateLogRatios(pointFlow.test, pointFlowScale);

  const evaluate = (params: GlickoParams) => {
    const split = collectCareerRatingDiffs(fights, noResults, params, testFromDate, initialRatingOf);
    const scale = fitScale(split.train);
    return { scale, train: evaluateLogRatios(split.train, scale), test: evaluateLogRatios(split.test, scale), movers: evaluateLogRatios(split.testMovers, scale) };
  };

  const startedAt = Date.now();
  const objective = (params: GlickoParams) => evaluate(params).train.logLoss;
  const search = patternSearch<GlickoParams>(objective, DEFAULT_GLICKO_PARAMS, SEARCH_SPACE, {
    refinements: 3,
    maxEvaluations: 600,
    onImprove: (key, value, score) => console.log(`  ${String(key).padEnd(20)} -> ${Number(value).toPrecision(4).padEnd(8)} train log-loss ${score.toFixed(5)}`),
  });
  console.log(`  ${search.evaluations} evaluations in ${((Date.now() - startedAt) / 1000).toFixed(0)} s.\n`);

  // Readable values (2 significant digits) when that costs (almost) nothing on train.
  let tuned = { ...search.params };
  let tunedObjective = search.objective;
  for (const key of Object.keys(SEARCH_SPACE) as (keyof GlickoParams)[]) {
    const rounded = Number(tuned[key].toPrecision(2));
    if (rounded === tuned[key]) continue;
    const candidate = { ...tuned, [key]: rounded };
    const score = objective(candidate);
    if (score <= tunedObjective + 0.0002) {
      tuned = candidate;
      tunedObjective = Math.min(score, tunedObjective);
    }
  }

  const shipped = evaluate(DEFAULT_GLICKO_PARAMS);
  const candidate = evaluate(tuned);
  console.log('Constant              shipped    tuned');
  for (const key of Object.keys(SEARCH_SPACE) as (keyof GlickoParams)[]) {
    const spec = SEARCH_SPACE[key]!;
    const atBound = tuned[key] === spec.min ? '  (lower bound)' : tuned[key] === spec.max ? '  (upper bound)' : '';
    console.log(`  ${String(key).padEnd(20)} ${String(DEFAULT_GLICKO_PARAMS[key]).padEnd(10)} ${tuned[key]}${atBound}`);
  }
  console.log(`\nHeld-out test set (${candidate.test.count} fights from ${testFromDate}):`);
  console.log(`  point flow (shipped v1)   log-loss ${pointFlowTest.logLoss.toFixed(4)}  accuracy ${pct(pointFlowTest.accuracy)}`);
  console.log(`  Glicko, shipped defaults  log-loss ${shipped.test.logLoss.toFixed(4)}  accuracy ${pct(shipped.test.accuracy)}  | division movers ${shipped.movers.logLoss.toFixed(4)} (${shipped.movers.count})`);
  console.log(`  Glicko, tuned             log-loss ${candidate.test.logLoss.toFixed(4)}  accuracy ${pct(candidate.test.accuracy)}  | division movers ${candidate.movers.logLoss.toFixed(4)} (${candidate.movers.count})`);

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify(
      {
        tunedAt: new Date().toISOString(),
        testFromDate,
        fightCount: fights.length,
        pointFlowReference: { test: pointFlowTest, winProbabilityScale: pointFlowScale },
        shipped: { params: DEFAULT_GLICKO_PARAMS, ...shipped },
        candidate: { params: tuned, ...candidate },
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`\nWrote ${path.relative(process.cwd(), OUTPUT_FILE)}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
