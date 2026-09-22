// data/scripts/tune-point-flow.ts
//
// Chooses the point-flow constants by measurement: searches PointFlowParams
// for the set whose pre-fight points best predict each fight's winner
// (log-loss, see data/lib/rating/point-flow-tuning.ts), tuned on the oldest
// 80% of fights and judged on the most recent 20% it never saw. Compares
// against the hand-picked constants, writes the result to
// data/ml-models/point-flow-params.json (alongside the shipped constants --
// promoting a candidate into point-flow.ts stays a manual, reviewed step).
// Read-only against Neon. Run with
// `npm run tune:ratings` (`--refresh` to re-fetch instead of using the local
// cache in data/scraped/.cache/).
import fs from 'node:fs';
import path from 'node:path';
import { simulateDivisionRatings, pointsAsOf } from '../lib/rating/simulate-division';
import { DEFAULT_POINT_FLOW_PARAMS, HAND_PICKED_POINT_FLOW_PARAMS, type PointFlowParams } from '../lib/rating/point-flow';
import { loadData } from './tuning-data';
import { collectWinnerLogRatios, evaluateLogRatios, fitScale, patternSearch, type ParamSearchSpace, type PredictionMetrics, type TuningDivision } from '../lib/rating/point-flow-tuning';

const OUTPUT_FILE = path.resolve('data/ml-models/point-flow-params.json');
const TEST_SHARE = 0.2;

// Bounds keep every constant's meaning intact (a "bonus" multiplier can't
// become a penalty, shares stay positive) -- the formula stays the one
// explained on the methodology page; a value pinned at a bound means the data
// wants that bonus switched off, reported as such below.
const SEARCH_SPACE: ParamSearchSpace = {
  opponentShare: { min: 0.005, max: 3, kind: 'log', step: 1.6 },
  activityCreditShare: { min: 0.0005, max: 3, kind: 'log', step: 1.6 },
  lossBaseShare: { min: 0.0005, max: 3, kind: 'log', step: 1.6 },
  floorRuleBonus: { min: 0.00001, max: 1, kind: 'log', step: 2 },
  gainDominanceBase: { min: 0, max: 3, kind: 'linear', step: 0.2 },
  gainDominanceSlope: { min: 0, max: 4, kind: 'linear', step: 0.2 },
  lossDominanceBase: { min: 0, max: 3, kind: 'linear', step: 0.2 },
  lossDominanceSlope: { min: 0, max: 4, kind: 'linear', step: 0.2 },
  streakStep: { min: 0, max: 0.3, kind: 'linear', step: 0.02 },
  streakCap: { min: 1, max: 30, kind: 'linear', step: 4, integer: true },
  titleWinMultiplier: { min: 1, max: 4, kind: 'linear', step: 0.25 },
  titleLossDivisor: { min: 1, max: 8, kind: 'linear', step: 0.25 },
  fiveRoundMultiplier: { min: 1, max: 3, kind: 'linear', step: 0.1 },
  formerChampionMultiplier: { min: 1, max: 4, kind: 'linear', step: 0.25 },
  erosionGraceMonths: { min: 0, max: 36, kind: 'linear', step: 4, integer: true },
  erosionRatePerMonth: { min: 0.8, max: 1, kind: 'linear', step: 0.02 },
  erosionFloorShare: { min: 0, max: 1, kind: 'linear', step: 0.1 },
};

type Evaluation = { scale: number; train: PredictionMetrics; test: PredictionMetrics };

function evaluate(divisions: TuningDivision[], params: PointFlowParams, testFromDate: string): Evaluation {
  const { train, test } = collectWinnerLogRatios(divisions, params, testFromDate);
  const scale = fitScale(train); // fitted on train only -- test never influences any number
  return { scale, train: evaluateLogRatios(train, scale), test: evaluateLogRatios(test, scale) };
}

/** Rounds to 2 significant digits (integers stay integers) -- a methodology page reads "0.22", not "0.2173914". */
function roundForDisplay(value: number, integer: boolean | undefined): number {
  if (integer) return Math.round(value);
  if (Math.abs(value) < 1e-6) return 0; // linear steps halved from e.g. 0.2 leave float dust like 5.6e-17
  return Number(value.toPrecision(2));
}

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

async function main() {
  const { divisions, fighterNames } = await loadData();
  const fightLists: TuningDivision[] = divisions;
  const allDates = divisions.flatMap((d) => d.fights).map((f) => f.eventDate).sort();
  const testFromDate = allDates[Math.floor(allDates.length * (1 - TEST_SHARE))];
  console.log(`${allDates.length} fights across ${divisions.length} divisions. Tuning on fights before ${testFromDate}, testing on ${testFromDate} onward.\n`);

  const startedAt = Date.now();
  const handPicked = evaluate(fightLists, HAND_PICKED_POINT_FLOW_PARAMS, testFromDate);
  console.log(`One evaluation takes ~${Date.now() - startedAt} ms.`);
  console.log(`Hand-picked constants: train log-loss ${handPicked.train.logLoss.toFixed(4)}, test log-loss ${handPicked.test.logLoss.toFixed(4)}, test accuracy ${pct(handPicked.test.accuracy)} (k=${handPicked.scale.toFixed(3)})\n`);

  console.log('Pattern search (objective = train log-loss, k refitted each time):');
  const objective = (params: PointFlowParams) => {
    const { train } = collectWinnerLogRatios(fightLists, params, testFromDate);
    return evaluateLogRatios(train, fitScale(train)).logLoss;
  };
  const search = patternSearch(objective, HAND_PICKED_POINT_FLOW_PARAMS, SEARCH_SPACE, {
    refinements: 4,
    maxEvaluations: 1500,
    onImprove: (key, value, score) => console.log(`  ${String(key).padEnd(26)} -> ${value.toPrecision(4).padEnd(10)} train log-loss ${score.toFixed(5)}`),
  });
  console.log(`  ${search.evaluations} evaluations in ${((Date.now() - startedAt) / 1000).toFixed(0)} s.\n`);

  // Round to readable values, one constant at a time, keeping each rounding
  // only if it costs (almost) nothing on the TRAIN objective.
  let tuned = { ...search.params };
  let tunedObjective = search.objective;
  for (const key of Object.keys(SEARCH_SPACE) as (keyof PointFlowParams)[]) {
    const spec = SEARCH_SPACE[key]!;
    const rounded = Math.min(spec.max, Math.max(spec.min, roundForDisplay(tuned[key], spec.integer)));
    if (rounded === tuned[key]) continue;
    const candidate = { ...tuned, [key]: rounded };
    const score = objective(candidate);
    if (score <= tunedObjective + 0.0002) {
      tuned = candidate;
      tunedObjective = Math.min(score, tunedObjective);
    }
  }
  const tunedEval = evaluate(fightLists, tuned, testFromDate);

  console.log('Constant                    hand-picked      tuned');
  for (const key of Object.keys(SEARCH_SPACE) as (keyof PointFlowParams)[]) {
    const spec = SEARCH_SPACE[key]!;
    const atBound = tuned[key] === spec.min ? '  (lower bound)' : tuned[key] === spec.max ? '  (upper bound)' : '';
    console.log(`  ${String(key).padEnd(26)} ${String(HAND_PICKED_POINT_FLOW_PARAMS[key]).padEnd(16)} ${String(tuned[key])}${atBound}`);
  }

  const coinFlip = Math.log(2);
  console.log(`\nHeld-out test set (${tunedEval.test.count} fights from ${testFromDate}, never used for tuning):`);
  console.log(`  coin flip      log-loss ${coinFlip.toFixed(4)}  accuracy 50.0%`);
  console.log(`  hand-picked    log-loss ${handPicked.test.logLoss.toFixed(4)}  accuracy ${pct(handPicked.test.accuracy)}  k=${handPicked.scale.toFixed(3)}`);
  const shipped = evaluate(fightLists, DEFAULT_POINT_FLOW_PARAMS, testFromDate);
  console.log(`  shipped (DEFAULT_POINT_FLOW_PARAMS) log-loss ${shipped.test.logLoss.toFixed(4)}  accuracy ${pct(shipped.test.accuracy)}  k=${shipped.scale.toFixed(3)}`);
  console.log(`  this run's candidate log-loss ${tunedEval.test.logLoss.toFixed(4)}  accuracy ${pct(tunedEval.test.accuracy)}  k=${tunedEval.scale.toFixed(3)}`);
  // Paired comparison on the same test fights: is the gain bigger than noise?
  const handPickedTest = collectWinnerLogRatios(fightLists, HAND_PICKED_POINT_FLOW_PARAMS, testFromDate).test;
  const tunedTest = collectWinnerLogRatios(fightLists, tuned, testFromDate).test;
  const negLogLikelihood = (x: number, k: number) => evaluateLogRatios([x], k).logLoss;
  const gains = tunedTest.map((x, i) => negLogLikelihood(handPickedTest[i], handPicked.scale) - negLogLikelihood(x, tunedEval.scale));
  const meanGain = gains.reduce((a, b) => a + b, 0) / gains.length;
  const standardError = Math.sqrt(gains.reduce((a, g) => a + (g - meanGain) ** 2, 0) / (gains.length - 1) / gains.length);
  console.log(`  log-loss gain ${meanGain.toFixed(4)} ± ${standardError.toFixed(4)} (1 paired standard error) -> ${(meanGain / standardError).toFixed(1)} SE from zero`);
  console.log(`  (train: hand-picked ${handPicked.train.logLoss.toFixed(4)}, tuned ${tunedEval.train.logLoss.toFixed(4)})`);

  console.log('\nTop 5 per division with the tuned constants, eroded to today (sanity check -- does the ranking still look like MMA?):');
  const todayIso = new Date().toISOString().slice(0, 10);
  for (const division of divisions) {
    const { fighterStates } = simulateDivisionRatings(division.fights, tuned, division.noResults);
    const top = Array.from(fighterStates.entries())
      .map(([id, state]) => [id, pointsAsOf(state, todayIso, tuned)] as const)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => fighterNames[id] ?? String(id));
    console.log(`  ${division.name.padEnd(22)} ${top.join(', ')}`);
  }

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify(
      {
        tunedAt: new Date().toISOString(),
        testFromDate,
        fightCount: allDates.length,
        // What point-flow.ts actually uses. A new candidate is only promoted there by
        // hand, after checking its rankings still make sense -- several constant
        // sets predict equally well but rank very differently.
        shipped: { params: DEFAULT_POINT_FLOW_PARAMS, train: shipped.train, test: shipped.test, winProbabilityScale: shipped.scale },
        candidate: { params: tuned, train: tunedEval.train, test: tunedEval.test, winProbabilityScale: tunedEval.scale },
        handPicked: { params: HAND_PICKED_POINT_FLOW_PARAMS, train: handPicked.train, test: handPicked.test, winProbabilityScale: handPicked.scale },
        coinFlipLogLoss: coinFlip,
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
