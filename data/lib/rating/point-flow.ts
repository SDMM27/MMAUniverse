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

// No erosion for the first 12 months of inactivity, then ~2%/month beyond
// that, floored at 40% of the pre-erosion value -- a long-inactive former
// champion fades rather than vanishing from the division entirely.
const EROSION_GRACE_MONTHS = 12;
const EROSION_RATE_PER_MONTH = 0.98;
const EROSION_FLOOR_SHARE = 0.4;

// A win/loss streak beyond this length stops adding further multiplier --
// avoids an unbounded runaway for a very long win streak.
const STREAK_CAP = 20;
const STREAK_STEP = 0.005;

const TITLE_WIN_MULTIPLIER = 1.5;
const TITLE_LOSS_DIVISOR = 1.3; // losing a title fight costs LESS -- divides the loss, doesn't multiply it
const FIVE_ROUND_MULTIPLIER = 1.1;
const FORMER_CHAMPION_MULTIPLIER = 1.5;

// Calibrated 2026-09-14 against the real, fully-backfilled dataset (see
// data/scripts/calibrate-ratings.ts) -- the spec's original starting point
// (0.5/0.5) produced runaway exponential growth (division maxima up to
// ~13,000 after a few hundred fights, since both terms scale with the
// current, ever-growing state -- opponent points and the division average
// -- compounding every fight). These smaller shares keep division maxima in
// the single digits (observed max ~3.8 across all divisions after
// calibration), a much more plausible scale, without changing the formula's
// shape or the "beat a well-regarded opponent, gain a lot" property itself.
const OPPONENT_SHARE = 0.15; // the winner takes this fraction of the loser's (eroded) points
const ACTIVITY_CREDIT_SHARE = 0.1; // ... plus this fraction of the division's average points, to reward activity
const FLOOR_RULE_BONUS = 0.01; // winner's points, when the floor rule triggers, land this far above the loser's

const LOSS_BASE_SHARE = 0.1; // starting constant -- see the spec's note on the source text's 10%/20% ambiguity
const LOSER_POINTS_FLOOR = 0.001; // a loss never drops a fighter's points to zero or below

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
export function erodePoints(points: number, monthsInactive: number): number {
  if (monthsInactive <= EROSION_GRACE_MONTHS) return points;
  const decayed = points * Math.pow(EROSION_RATE_PER_MONTH, monthsInactive - EROSION_GRACE_MONTHS);
  return Math.max(decayed, points * EROSION_FLOOR_SHARE);
}

function streakMultiplier(streak: number): number {
  return 1 + STREAK_STEP * Math.min(Math.abs(streak), STREAK_CAP);
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
export function applyPointFlow(winner: FighterPointState, loser: FighterPointState, context: FightContext): PointFlowResult {
  const winnerEroded = erodePoints(winner.points, winner.monthsSinceLastFight);
  const loserEroded = erodePoints(loser.points, loser.monthsSinceLastFight);

  const titleWinMultiplier = context.isTitleFight ? TITLE_WIN_MULTIPLIER : 1.0;
  const titleLossDivisor = context.isTitleFight ? TITLE_LOSS_DIVISOR : 1.0;
  const fiveRoundMultiplier = context.isFiveRounds ? FIVE_ROUND_MULTIPLIER : 1.0;
  const formerChampionMultiplier = winner.isFormerChampion ? FORMER_CHAMPION_MULTIPLIER : 1.0;

  const dominanceMultiplier = 0.8 + 0.9 * context.dominanceScore;
  const gain =
    (OPPONENT_SHARE * loserEroded * dominanceMultiplier + ACTIVITY_CREDIT_SHARE * context.divisionAveragePoints) *
    streakMultiplier(winner.currentStreak) *
    titleWinMultiplier *
    fiveRoundMultiplier *
    formerChampionMultiplier;

  let winnerPoints = winnerEroded + gain;
  if (winnerPoints <= loserEroded) {
    winnerPoints = loserEroded + FLOOR_RULE_BONUS;
  }

  const lossDominanceFactor = 0.6 + 0.8 * context.dominanceScore;
  const loss =
    (LOSS_BASE_SHARE * context.divisionAveragePoints * lossDominanceFactor * streakMultiplier(loser.currentStreak)) /
    titleLossDivisor;
  const loserPoints = Math.max(loserEroded - loss, LOSER_POINTS_FLOOR);

  return { winnerPoints, loserPoints };
}
