// data/lib/rating/display-scores.ts
//
// Turns FightScore v2 conservative ratings (R - 2 RD, ./glicko-rating.ts)
// into the 0-100 numbers the site shows -- see docs/superpowers/specs/
// 2026-09-22-fightscore-glicko-design.md, section 4. Two scales:
// - display_score, per division: 200 x the chance of beating the division's
//   best eligible fighter. Editorial rule requested by the user: the reigning
//   champion (is_champion, the official UFC ranking) is always 100 and #1;
//   everyone else is capped at CHALLENGER_SCORE_CAP, in rating order.
// - p4p_score: the same formula on one scale for a whole gender, no champion
//   rule (otherwise every champion would tie at 100).
import { scoreAgainstReference } from './glicko-rating';
import { RANKING_INACTIVITY_CUTOFF_MONTHS } from './ranking-eligibility';
import { monthsBetween } from './simulate-division';

export const CHALLENGER_SCORE_CAP = 99.9;

/**
 * Whether a (fighter, division) row appears in that division's ranking: the
 * champion always does; otherwise the division must be the fighter's most
 * recent one (someone who just moved up isn't listed twice with the same
 * rating) and they must have competed in it within the inactivity cutoff.
 */
export function isEligibleInDivision(
  row: { lastFightDateInDivision: string | null; isChampion: boolean; isLatestDivision: boolean },
  asOfDateIso: string,
): boolean {
  if (row.isChampion) return true;
  if (!row.isLatestDivision || !row.lastFightDateInDivision) return false;
  return monthsBetween(row.lastFightDateInDivision, asOfDateIso) <= RANKING_INACTIVITY_CUTOFF_MONTHS;
}

function referenceRating(rows: { conservative: number; eligible: boolean }[]): number {
  const pool = rows.some((r) => r.eligible) ? rows.filter((r) => r.eligible) : rows;
  return Math.max(...pool.map((r) => r.conservative));
}

export function divisionDisplayScores(rows: { fighterId: number; conservative: number; isChampion: boolean; eligible: boolean }[]): Map<number, number> {
  const scores = new Map<number, number>();
  if (rows.length === 0) return scores;
  const reference = referenceRating(rows);
  const hasChampion = rows.some((r) => r.isChampion);
  for (const row of rows) {
    const score = scoreAgainstReference(row.conservative, reference);
    if (row.isChampion) scores.set(row.fighterId, 100);
    else if (hasChampion || !row.eligible) scores.set(row.fighterId, Math.min(CHALLENGER_SCORE_CAP, score));
    else scores.set(row.fighterId, score);
  }
  return scores;
}

export function poundForPoundScores(rows: { fighterId: number; conservative: number; eligible: boolean }[]): Map<number, number> {
  const scores = new Map<number, number>();
  if (rows.length === 0) return scores;
  const reference = referenceRating(rows);
  for (const row of rows) scores.set(row.fighterId, scoreAgainstReference(row.conservative, reference));
  return scores;
}
