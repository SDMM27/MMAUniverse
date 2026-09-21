// data/lib/rating/point-flow.ts
//
// The FightScore point-flow rating engine -- see docs/superpowers/specs/
// 2026-09-14-fighter-rating-algorithm-design.md, "Moteur de notation - flux
// de points inspiré de fight-minds". Structurally inspired by fight-minds'
// own published methodology (points start near zero and grow, the winner
// takes a share of the loser's points, a floor rule guarantees you can never
// rank below someone you legitimately beat) -- but the method-coefficient
// table fight-minds uses is deliberately NOT copied (their public text rates
// a unanimous decision above a KO/TKO, which contradicts what this project
// already decided: see computeDominanceScore in ./dominance-score.ts, used
// here in place of that table).
export const BASE_POINTS = 0.01;
const LOSER_POINTS_FLOOR = 0.001; // a loss never drops a fighter's points to zero or below

/**
 * Every tunable constant of the formula. The formula's *shape* is fixed and
 * explainable; these values are what data/scripts/tune-point-flow.ts searches
 * over, picking the set that minimizes log-loss when the pre-fight points are
 * used to predict each fight's winner (see ./point-flow-tuning.ts).
 * BASE_POINTS / LOSER_POINTS_FLOOR are deliberately NOT tunable: they only
 * anchor the scale, and display_score is rescaled per division anyway.
 */
export type PointFlowParams = {
  // Erosion: none for the first `erosionGraceMonths` of inactivity, then
  // multiplied by `erosionRatePerMonth` per extra month, floored at
  // `erosionFloorShare` of the pre-erosion value -- a long-inactive former
  // champion fades rather than vanishing from the division entirely.
  erosionGraceMonths: number;
  erosionRatePerMonth: number;
  erosionFloorShare: number;
  // A win/loss streak beyond `streakCap` stops adding further multiplier.
  streakCap: number;
  streakStep: number;
  titleWinMultiplier: number;
  titleLossDivisor: number; // losing a title fight costs LESS -- divides the loss, doesn't multiply it
  fiveRoundMultiplier: number;
  formerChampionMultiplier: number;
  opponentShare: number; // the winner takes this fraction of the loser's (eroded) points
  activityCreditShare: number; // ... plus this fraction of the division's average points, to reward activity
  floorRuleBonus: number; // winner's points, when the floor rule triggers, land this far above the loser's
  lossBaseShare: number;
  // Dominance scaling: gain multiplier = gainDominanceBase + gainDominanceSlope * dominance,
  // loss factor = lossDominanceBase + lossDominanceSlope * dominance.
  gainDominanceBase: number;
  gainDominanceSlope: number;
  lossDominanceBase: number;
  lossDominanceSlope: number;
};

// The hand-picked values the engine shipped with (2026-09-14, calibrated by
// eye in data/scripts/calibrate-ratings.ts to keep division maxima in the
// single digits). Kept as the reference point tune-point-flow.ts compares
// against.
export const HAND_PICKED_POINT_FLOW_PARAMS: PointFlowParams = {
  erosionGraceMonths: 12,
  erosionRatePerMonth: 0.98,
  erosionFloorShare: 0.4,
  streakCap: 20,
  streakStep: 0.005,
  titleWinMultiplier: 1.5,
  titleLossDivisor: 1.3,
  fiveRoundMultiplier: 1.1,
  formerChampionMultiplier: 1.5,
  opponentShare: 0.15,
  activityCreditShare: 0.1,
  floorRuleBonus: 0.01,
  lossBaseShare: 0.1,
  gainDominanceBase: 0.8,
  gainDominanceSlope: 0.9,
  lossDominanceBase: 0.6,
  lossDominanceSlope: 0.8,
};

// Chosen by `npm run tune:ratings` (2026-09-17): the values minimizing
// log-loss when pre-fight points predict the winner, tuned on the 5,870 UFC
// fights before 2023-03-11 and checked on the 1,468 after. Held-out log-loss
// 0.6767 vs 0.6931 for the hand-picked set (= a coin flip), accuracy 57.0% vs
// 53.8% (re-measured with no contests counted as activity). Full numbers:
// data/ml-models/point-flow-params.json. What the data said: streak, five-round and former-champion bonuses add no predictive
// value (pinned at neutral), inactivity should start eroding after 4 months
// not 12, and a title-fight loss should cost far less than a regular loss.
export const DEFAULT_POINT_FLOW_PARAMS: PointFlowParams = {
  erosionGraceMonths: 4,
  erosionRatePerMonth: 0.96,
  erosionFloorShare: 0.65,
  streakCap: 20,
  streakStep: 0,
  titleWinMultiplier: 1.6,
  titleLossDivisor: 8,
  fiveRoundMultiplier: 1,
  formerChampionMultiplier: 1,
  opponentShare: 0.24,
  activityCreditShare: 0.066,
  floorRuleBonus: 0.00063,
  lossBaseShare: 0.1,
  gainDominanceBase: 0.19,
  gainDominanceSlope: 1.1,
  lossDominanceBase: 0,
  lossDominanceSlope: 2.6,
};

export type FighterPointState = {
  points: number;
  currentStreak: number; // positive = win streak, negative = loss streak, 0 = coming off a draw/no fights yet
  isFormerChampion: boolean;
  monthsSinceLastFight: number;
};

export type FightContext = {
  dominanceScore: number; // from computeDominanceScore, 0-1
  isTitleFight: boolean;
  isFiveRounds: boolean;
  divisionAveragePoints: number; // caller-maintained running average across the division, see the batch script (plan Task 7)
};

export type PointFlowResult = { winnerPoints: number; loserPoints: number };

/** Erodes a fighter's points toward zero based on months of inactivity -- see the module doc comment above. */
export function erodePoints(points: number, monthsInactive: number, params: PointFlowParams = DEFAULT_POINT_FLOW_PARAMS): number {
  if (monthsInactive <= params.erosionGraceMonths) return points;
  const decayed = points * Math.pow(params.erosionRatePerMonth, monthsInactive - params.erosionGraceMonths);
  return Math.max(decayed, points * params.erosionFloorShare);
}

function streakMultiplier(streak: number, params: PointFlowParams): number {
  return 1 + params.streakStep * Math.min(Math.abs(streak), params.streakCap);
}

/**
 * Applies one fight's result to both fighters' point totals. Erodes each
 * side's points for their own inactivity first, then the winner gains a
 * dominance-scaled share of the loser's (eroded) points plus an
 * activity-credit share of the division average, multiplied by
 * streak/title/five-round/former-champion bonuses -- floored so the winner
 * always ends up strictly ahead of the loser (fight-minds' own rule: you can
 * never rank below someone you just beat). The loser loses a
 * dominance-scaled share of the division average, discounted (not
 * multiplied) for a title fight, floored above zero.
 */
export function applyPointFlow(
  winner: FighterPointState,
  loser: FighterPointState,
  context: FightContext,
  params: PointFlowParams = DEFAULT_POINT_FLOW_PARAMS,
): PointFlowResult {
  const winnerEroded = erodePoints(winner.points, winner.monthsSinceLastFight, params);
  const loserEroded = erodePoints(loser.points, loser.monthsSinceLastFight, params);

  const titleWinMultiplier = context.isTitleFight ? params.titleWinMultiplier : 1.0;
  const titleLossDivisor = context.isTitleFight ? params.titleLossDivisor : 1.0;
  const fiveRoundMultiplier = context.isFiveRounds ? params.fiveRoundMultiplier : 1.0;
  const formerChampionMultiplier = winner.isFormerChampion ? params.formerChampionMultiplier : 1.0;

  const dominanceMultiplier = params.gainDominanceBase + params.gainDominanceSlope * context.dominanceScore;
  const gain =
    (params.opponentShare * loserEroded * dominanceMultiplier + params.activityCreditShare * context.divisionAveragePoints) *
    streakMultiplier(winner.currentStreak, params) *
    titleWinMultiplier *
    fiveRoundMultiplier *
    formerChampionMultiplier;

  let winnerPoints = winnerEroded + gain;
  if (winnerPoints <= loserEroded) {
    winnerPoints = loserEroded + params.floorRuleBonus;
  }

  const lossDominanceFactor = params.lossDominanceBase + params.lossDominanceSlope * context.dominanceScore;
  const loss =
    (params.lossBaseShare * context.divisionAveragePoints * lossDominanceFactor * streakMultiplier(loser.currentStreak, params)) /
    titleLossDivisor;
  const loserPoints = Math.max(loserEroded - loss, LOSER_POINTS_FLOOR);

  return { winnerPoints, loserPoints };
}
