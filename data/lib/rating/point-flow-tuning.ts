// data/lib/rating/point-flow-tuning.ts
//
// Picks the point-flow constants (./point-flow.ts, PointFlowParams) by
// measurement instead of by eye: a set of constants is judged by how well the
// points it produces BEFORE each fight predict that fight's winner, scored by
// log-loss on fights the constants were not chosen on (chronological split).
// The formula itself stays the explainable point-flow formula -- only its
// numbers change.
//
// Points -> win probability uses the Bradley-Terry form
//   P(A beats B) = a^k / (a^k + b^k) = sigmoid(k * ln(a / b))
// where a, b are the eroded pre-fight points. It only depends on the RATIO of
// points (display_score is a per-division rescale, so absolute scale is
// meaningless anyway), is symmetric (P(A beats B) = 1 - P(B beats A)), and has
// a single fitted number k -- "how sharply does a points gap translate into a
// win probability" -- fitted on the training fights alongside the constants.
// Pure functions, no DB access: data/scripts/tune-point-flow.ts owns the I/O.
import type { PointFlowParams } from './point-flow';
import { simulateDivisionRatings, type DivisionFightInput, type DivisionNoResultInput } from './simulate-division';

export type TuningDivision = { fights: DivisionFightInput[]; noResults?: DivisionNoResultInput[] };

const EPSILON = 1e-12;

function sigmoid(z: number): number {
  return z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z));
}

/** P(fighter with `pointsA` beats fighter with `pointsB`) -- see the module doc comment. */
export function winProbabilityFromPoints(pointsA: number, pointsB: number, scale: number): number {
  return sigmoid(scale * Math.log(pointsA / pointsB));
}

export type PredictionMetrics = { logLoss: number; accuracy: number; count: number };

/**
 * Scores predictions given, per fight, ln(winnerPoints / loserPoints). Because
 * the model is symmetric, "the winner's side" framing loses no generality:
 * log-loss = mean of -ln P(actual winner). A 0 ratio (identical points,
 * typically two debutants) counts as half a correct pick.
 */
export function evaluateLogRatios(winnerLogRatios: number[], scale: number): PredictionMetrics {
  if (winnerLogRatios.length === 0) return { logLoss: NaN, accuracy: NaN, count: 0 };
  let loss = 0;
  let correct = 0;
  for (const x of winnerLogRatios) {
    loss -= Math.log(Math.max(sigmoid(scale * x), EPSILON));
    correct += x > 0 ? 1 : x === 0 ? 0.5 : 0;
  }
  return { logLoss: loss / winnerLogRatios.length, accuracy: correct / winnerLogRatios.length, count: winnerLogRatios.length };
}

const MAX_SCALE = 50;

/**
 * Fits k minimizing evaluateLogRatios' log-loss (1-D convex problem, Newton's
 * method). Returns 0 when there's no signal (all ratios 0), and caps at
 * MAX_SCALE when the ratios perfectly separate (loss keeps falling forever).
 */
export function fitScale(winnerLogRatios: number[]): number {
  if (winnerLogRatios.every((x) => x === 0)) return 0;
  let k = 1;
  for (let iter = 0; iter < 100; iter++) {
    let gradient = 0;
    let hessian = 0;
    for (const x of winnerLogRatios) {
      const p = sigmoid(k * x);
      gradient -= (1 - p) * x;
      hessian += p * (1 - p) * x * x;
    }
    if (hessian < EPSILON) return gradient < 0 ? MAX_SCALE : k;
    const next = Math.min(MAX_SCALE, Math.max(0, k - gradient / hessian));
    if (Math.abs(next - k) < 1e-9) return next;
    k = next;
  }
  return k;
}

export type LogRatioSplit = { train: number[]; test: number[] };

/**
 * Runs every division's simulation with `params` and collects, per fight, the
 * pre-fight eroded ln(winnerPoints / loserPoints) -- strictly point-in-time
 * (the fight's own result is applied only after its prediction is read), so
 * every entry is a genuine "predict the next fight" sample. Fights before
 * `testFromDate` go to `train`, the rest to `test`. The simulation always runs
 * over the full history either way: test fights are predicted from ratings
 * built on everything that came before them, exactly as in production.
 */
export function collectWinnerLogRatios(divisions: TuningDivision[], params: PointFlowParams, testFromDate: string): LogRatioSplit {
  const split: LogRatioSplit = { train: [], test: [] };
  for (const { fights, noResults } of divisions) {
    const { history } = simulateDivisionRatings(fights, params, noResults);
    for (const entry of history) {
      const x = Math.log(entry.winnerPointsBeforeEroded / entry.loserPointsBeforeEroded);
      (entry.eventDate < testFromDate ? split.train : split.test).push(x);
    }
  }
  return split;
}

export type ParamSearchSpec = {
  min: number;
  max: number;
  // 'log': moves multiply/divide by `step` (> 1); 'linear': moves add/subtract `step`.
  kind: 'log' | 'linear';
  step: number;
  integer?: boolean;
};

// Generic over the parameter set: used for PointFlowParams and GlickoParams alike.
export type ParamSearchSpace<T extends Record<string, number> = PointFlowParams> = Partial<Record<keyof T, ParamSearchSpec>>;

export type TuningResult<T extends Record<string, number> = PointFlowParams> = { params: T; objective: number; evaluations: number };

/**
 * Derivative-free pattern search (coordinate descent with shrinking steps):
 * for each tunable constant in turn, try one step up and one step down within
 * its bounds and keep any move that lowers `objective`; once a full sweep
 * finds no improvement, halve every step (sqrt for 'log' steps), up to
 * `refinements` times. Chosen over gradient methods because the objective is
 * not smooth (floor rule, streak cap, integer grace months) and over a
 * black-box optimizer because every move stays readable in the log.
 */
export function patternSearch<T extends Record<string, number> = PointFlowParams>(
  objective: (params: T) => number,
  start: T,
  space: ParamSearchSpace<T>,
  options: { refinements?: number; maxEvaluations?: number; onImprove?: (key: keyof T, value: number, objective: number) => void } = {},
): TuningResult<T> {
  const refinements = options.refinements ?? 4;
  const maxEvaluations = options.maxEvaluations ?? 2000;
  const keys = Object.keys(space) as (keyof T)[];
  const steps = new Map(keys.map((key) => [key, space[key]!.step]));

  const clampToSpec = (value: number, spec: ParamSearchSpec) => {
    const rounded = spec.integer ? Math.round(value) : value;
    return Math.min(spec.max, Math.max(spec.min, rounded));
  };

  let best: T = { ...start };
  for (const key of keys) best[key] = clampToSpec(best[key], space[key]!) as T[keyof T];
  let bestObjective = objective(best);
  let evaluations = 1;

  for (let round = 0; round <= refinements && evaluations < maxEvaluations; round++) {
    let improved = true;
    while (improved && evaluations < maxEvaluations) {
      improved = false;
      for (const key of keys) {
        const spec = space[key]!;
        const step = steps.get(key)!;
        const current = best[key];
        const candidates = spec.kind === 'log' ? [current * step, current / step] : [current + step, current - step];
        for (const raw of candidates) {
          const value = clampToSpec(raw, spec);
          if (value === current || evaluations >= maxEvaluations) continue;
          const candidate: T = { ...best, [key]: value };
          const score = objective(candidate);
          evaluations++;
          if (score < bestObjective - 1e-7) {
            best = candidate;
            bestObjective = score;
            improved = true;
            options.onImprove?.(key, value, score);
            break;
          }
        }
      }
    }
    for (const key of keys) {
      const spec = space[key]!;
      const step = steps.get(key)!;
      steps.set(key, spec.kind === 'log' ? Math.sqrt(step) : spec.integer ? Math.max(1, Math.round(step / 2)) : step / 2);
    }
  }

  return { params: best, objective: bestObjective, evaluations };
}
