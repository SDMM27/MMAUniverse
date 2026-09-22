// data/lib/rating/glicko-rating.ts
//
// FightScore v2's rating engine -- see docs/superpowers/specs/
// 2026-09-22-fightscore-glicko-design.md. One Glicko-1 rating per fighter
// across every weight class (the v1 point flow restarted from zero at each
// division change, and rewarded fight volume because every win minted new
// points). A rating R plus a deviation RD ("how sure are we"): beating a
// strong opponent is worth a lot, beating a weak one little, and RD grows
// with inactivity and on a division change. Pure functions, no DB access.

export type GlickoParams = {
  initialRating: number;
  initialRd: number; // a debutant's RD, and the ceiling inactivity can grow it back to
  rdPerMonth: number; // Glicko's `c`: RD grows as sqrt(rd^2 + c^2 * months) while inactive
  rdOnDivisionChange: number; // extra uncertainty (added in quadrature) when a fighter changes weight class
  carryOverShare: number; // share of (rating - initialRating) kept on a division change; 1 = full carry-over
  winScoreFloor: number; // the winner's outcome score for a zero-dominance win (0.5 = no better than a draw); 1 for a total rout
  minRd: number; // RD never shrinks below this -- MMA careers are short, a rating is never "certain"
};

// Chosen by `npm run tune:glicko` -- see data/ml-models/glicko-params.json.
export const DEFAULT_GLICKO_PARAMS: GlickoParams = {
  initialRating: 1500,
  initialRd: 300,
  rdPerMonth: 20,
  rdOnDivisionChange: 50,
  carryOverShare: 1,
  winScoreFloor: 0.5,
  minRd: 30,
};

export type GlickoRating = { rating: number; rd: number };

const Q = Math.log(10) / 400;

export function rdAfterInactivity(rd: number, months: number, params: GlickoParams = DEFAULT_GLICKO_PARAMS): number {
  if (months <= 0) return rd;
  return Math.min(params.initialRd, Math.sqrt(rd * rd + params.rdPerMonth * params.rdPerMonth * months));
}

export function applyDivisionChange(state: GlickoRating, params: GlickoParams = DEFAULT_GLICKO_PARAMS): GlickoRating {
  return {
    rating: params.initialRating + (state.rating - params.initialRating) * params.carryOverShare,
    rd: Math.min(params.initialRd, Math.sqrt(state.rd * state.rd + params.rdOnDivisionChange * params.rdOnDivisionChange)),
  };
}

/** The winner's Glicko outcome score, from computeDominanceScore's 0-1 dominance. The loser's is 1 minus this. */
export function winnerOutcomeScore(dominance: number, params: GlickoParams = DEFAULT_GLICKO_PARAMS): number {
  return params.winScoreFloor + (1 - params.winScoreFloor) * Math.min(1, Math.max(0, dominance));
}

/** Expected score of `a` against `b` (b's RD discounts the rating gap, as in Glicko-1). */
export function expectedScore(a: GlickoRating, b: GlickoRating): number {
  const g = 1 / Math.sqrt(1 + (3 * Q * Q * b.rd * b.rd) / (Math.PI * Math.PI));
  return 1 / (1 + Math.pow(10, (-g * (a.rating - b.rating)) / 400));
}

/** Glicko-1 update of `a` after one bout against `b`, where `score` is a's outcome score (0-1). */
export function updateGlicko(a: GlickoRating, b: GlickoRating, score: number, params: GlickoParams = DEFAULT_GLICKO_PARAMS): GlickoRating {
  const g = 1 / Math.sqrt(1 + (3 * Q * Q * b.rd * b.rd) / (Math.PI * Math.PI));
  const e = 1 / (1 + Math.pow(10, (-g * (a.rating - b.rating)) / 400));
  const dSquared = 1 / (Q * Q * g * g * e * (1 - e));
  const precision = 1 / (a.rd * a.rd) + 1 / dSquared;
  return {
    rating: a.rating + (Q / precision) * g * (score - e),
    rd: Math.max(params.minRd, Math.sqrt(1 / precision)),
  };
}

/** What the ranking sorts by: "reasonably sure they're at least this good". Penalizes both thin records and long layoffs. */
export function conservativeRating(rating: number, rd: number): number {
  return rating - 2 * rd;
}

/**
 * 0-100 display score: twice the (Elo-scale) chance of beating the
 * reference fighter, capped at 100 -- the reference is worth 100, someone
 * 200 rating points below about 48.
 */
export function scoreAgainstReference(rating: number, referenceRating: number): number {
  const p = 1 / (1 + Math.pow(10, (referenceRating - rating) / 400));
  return Math.min(100, 200 * p);
}
