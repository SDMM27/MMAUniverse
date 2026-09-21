// data/lib/rating/ranking-eligibility.ts
//
// Who appears in the FightScore rankings (list page, pound-for-pound). The
// score itself keeps eroding with inactivity (see pointsAsOf), but the
// inactivity floor that best PREDICTS fights (a returning fighter keeps most
// of their level, see point-flow-tuning.ts) also lets retired legends keep
// enough points to sit on top of a "current" ranking. So, like the UFC's own
// rankings: a fighter who hasn't competed in this division for more than
// RANKING_INACTIVITY_CUTOFF_MONTHS drops out of the ranking (their score stays
// visible on their own page), except the reigning champion, who keeps their
// place until the belt is actually vacated or lost. No contests count as
// having competed (simulateDivisionRatings' noResults).
import { monthsBetween } from './simulate-division';

export const RANKING_INACTIVITY_CUTOFF_MONTHS = 18;

export function isRankingEligible(fighter: { lastFightDate: string | null; isChampion: boolean }, asOfDateIso: string): boolean {
  if (fighter.isChampion) return true;
  if (!fighter.lastFightDate) return false;
  return monthsBetween(fighter.lastFightDate, asOfDateIso) <= RANKING_INACTIVITY_CUTOFF_MONTHS;
}
