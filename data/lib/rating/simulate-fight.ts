// data/lib/rating/simulate-fight.ts
//
// "Who wins A vs B?" from two FightScore v2 Glicko ratings. Pure functions,
// no DB access. Unlike glicko-rating.ts' expectedScore (which only discounts
// the gap by the OPPONENT's RD, as a rating update needs), this discounts it
// by both fighters' RD combined so that P(A) + P(B) = 1 whichever corner you
// call A -- a matchup page must not depend on the order of the two names.

import { GlickoRating } from './glicko-rating';

const Q = Math.log(10) / 400;

// Thresholds sit on the real spread of current RDs (2026-09: p10 150, median
// 182, p90 252 across eligible fighters) -- a fighter is never "certain" here
// (minRd 30 is never approached), so absolute Glicko-textbook cutoffs would
// label everyone low.
const CONFIDENT_RD = 170;
const UNSURE_RD = 215;

export type FightPrediction = {
  winA: number; // 0-1
  winB: number; // 0-1, always 1 - winA
  ratingGap: number; // A's rating minus B's, in Glicko points
  confidence: 'high' | 'medium' | 'low'; // how much the two RDs let us trust the gap
};

export function predictFight(a: GlickoRating, b: GlickoRating): FightPrediction {
  const combinedRdSquared = a.rd * a.rd + b.rd * b.rd;
  const g = 1 / Math.sqrt(1 + (3 * Q * Q * combinedRdSquared) / (Math.PI * Math.PI));
  const ratingGap = a.rating - b.rating;
  const winA = 1 / (1 + Math.pow(10, (-g * ratingGap) / 400));
  const worstRd = Math.max(a.rd, b.rd);
  return { winA, winB: 1 - winA, ratingGap, confidence: worstRd <= CONFIDENT_RD ? 'high' : worstRd <= UNSURE_RD ? 'medium' : 'low' };
}
