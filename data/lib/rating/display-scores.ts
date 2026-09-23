// data/lib/rating/display-scores.ts
//
// Turns FightScore v2 conservative ratings (R - 2 RD, ./glicko-rating.ts)
// into the 0-100 numbers the site shows -- see docs/superpowers/specs/
// 2026-09-22-fightscore-glicko-design.md, section 4. Two scales:
// - display_score, per division: 200 x the chance of beating the division's
//   best eligible fighter. Editorial rule requested by the user: the reigning
//   champion (is_champion, the official UFC ranking) is always 100 and #1;
//   everyone else is capped at CHALLENGER_SCORE_CAP, in rating order.
// - p4p_score: the same formula on one scale for a whole gender. No "100 for
//   every champion" (they would all tie), but P4P never contradicts a
//   division ranking: a challenger rated above their own champion is brought
//   down just below them (see capChallengersBelowChampion).
import { scoreAgainstReference } from './glicko-rating';
import { RANKING_INACTIVITY_CUTOFF_MONTHS } from './ranking-eligibility';
import { monthsBetween } from './simulate-division';

export const CHALLENGER_SCORE_CAP = 99.9;

/**
 * The one division a fighter is ranked in (someone who changed weight class
 * isn't listed twice with the same rating): the division the official UFC
 * rankings list them in, if they have fought there recently enough to still
 * be listed -- so a one-off superfight at another weight doesn't move them --
 * otherwise their most recent division. The recency condition matters: a
 * fighter the UFC still ranks in the division they left (their old belt's)
 * would otherwise fall out of BOTH lists, their old one on inactivity and
 * their new one for not being "home" there.
 */
export function homeDivision(
  state: { lastDivision: string | null; lastFightDateByDivision: Map<string, string> },
  officialDivision: string | undefined,
  asOfDateIso: string,
): string | null {
  const officialLastFight = officialDivision ? state.lastFightDateByDivision.get(officialDivision) : undefined;
  if (officialLastFight && monthsBetween(officialLastFight, asOfDateIso) <= RANKING_INACTIVITY_CUTOFF_MONTHS) return officialDivision!;
  return state.lastDivision;
}

/**
 * Whether a (fighter, division) row appears in that division's ranking: the
 * champion always does; otherwise the division must be the fighter's home
 * division (see homeDivision) and they must have competed in it within the
 * inactivity cutoff.
 */
export function isEligibleInDivision(
  row: { lastFightDateInDivision: string | null; isChampion: boolean; isHomeDivision: boolean },
  asOfDateIso: string,
): boolean {
  if (row.isChampion) return true;
  if (!row.isHomeDivision || !row.lastFightDateInDivision) return false;
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

export const CHAMPION_P4P_MARGIN = 0.1;

/**
 * Pound-for-pound must agree with each division's own order, where the
 * champion is #1: nobody outranks the champion of their own division. A
 * challenger whose rating alone puts them at or above their champion (e.g. an
 * ex-champ whose longer record keeps a higher rating than the man who took
 * his belt) is brought down just below them, CHAMPION_P4P_MARGIN apart and
 * keeping their order among themselves. The champion keeps their own score --
 * lifting them instead would hand them points they never earned. Returns a
 * new map; `divisions` lists each division's champion and eligible fighters.
 */
export function capChallengersBelowChampion(
  scores: Map<number, number>,
  divisions: { championId: number | undefined; eligibleIds: Iterable<number> }[],
): Map<number, number> {
  const capped = new Map(scores);
  for (const { championId, eligibleIds } of divisions) {
    if (championId === undefined || !scores.has(championId)) continue;
    const championScore = scores.get(championId)!;
    const above = Array.from(eligibleIds)
      .filter((id) => id !== championId && scores.has(id) && scores.get(id)! >= championScore)
      .sort((a, b) => scores.get(b)! - scores.get(a)!);
    above.forEach((id, i) => capped.set(id, Math.max(0, championScore - CHAMPION_P4P_MARGIN * (i + 1))));
  }
  return capped;
}
