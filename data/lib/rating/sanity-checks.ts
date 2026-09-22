// data/lib/rating/sanity-checks.ts
//
// The "would an MMA fan accept this?" checks from docs/superpowers/specs/
// 2026-09-22-fightscore-glicko-design.md, section 5 -- the second metric,
// next to held-out log-loss, used to judge the rating method. Generic by
// design: no fighter names here (the named expert expectations live only in
// data/scripts/check-ratings.ts, reported, never tuned against). They
// validate the method; nothing in the rating reads them. Pure functions over
// simulateCareerRatings' history and a ranking the caller builds.
import { conservativeRating } from './glicko-rating';
import type { CareerHistoryEntry } from './simulate-career';
import { RANKING_INACTIVITY_CUTOFF_MONTHS } from './ranking-eligibility';
import { monthsBetween } from './simulate-division';

export type RankedFighter = { fighterId: number; division: string; conservative: number; isChampion: boolean; ufcFights: number };
export type CheckResult = { name: string; passed: boolean; details: string[] };

export const TOP_N = 10;

// How a check names a fighter in its details (the script passes a name lookup).
export type FighterLabel = (fighterId: number) => string;
const byId: FighterLabel = (id) => String(id);
export const THIN_RECORD_MAX_FIGHTS = 6;

/**
 * Per fighter, wins over an opponent who was top 10 of the fight's division
 * at fight time: rank by conservative rating among fighters who fought in
 * that division within the ranking inactivity cutoff, using each one's
 * rating after their latest bout there (RD inflation since then ignored --
 * a check, not the rating itself).
 */
export function winsOverTopTen(history: CareerHistoryEntry[]): Map<number, number> {
  const latest = new Map<string, Map<number, { conservative: number; date: string }>>();
  const wins = new Map<number, number>();
  for (const e of history) {
    const division = latest.get(e.division) ?? new Map<number, { conservative: number; date: string }>();
    latest.set(e.division, division);
    const loserConservative = conservativeRating(e.loserBefore.rating, e.loserBefore.rd);
    let above = 0;
    for (const [id, s] of Array.from(division.entries())) {
      if (id === e.loserId || id === e.winnerId) continue;
      if (monthsBetween(s.date, e.eventDate) > RANKING_INACTIVITY_CUTOFF_MONTHS) continue;
      if (s.conservative > loserConservative) above++;
    }
    if (above < TOP_N && e.loserUfcFightsBefore > 0) wins.set(e.winnerId, (wins.get(e.winnerId) ?? 0) + 1);
    division.set(e.winnerId, { conservative: conservativeRating(e.winnerAfter.rating, e.winnerAfter.rd), date: e.eventDate });
    division.set(e.loserId, { conservative: conservativeRating(e.loserAfter.rating, e.loserAfter.rd), date: e.eventDate });
  }
  return wins;
}

/** fighterId -> division -> title-fight wins. */
export function titleFightWins(history: CareerHistoryEntry[]): Map<number, Map<string, number>> {
  const wins = new Map<number, Map<string, number>>();
  for (const e of history) {
    if (!e.isTitleFight) continue;
    const byDivision = wins.get(e.winnerId) ?? new Map<string, number>();
    byDivision.set(e.division, (byDivision.get(e.division) ?? 0) + 1);
    wins.set(e.winnerId, byDivision);
  }
  return wins;
}

export function checkCarryOver(history: CareerHistoryEntry[], initialRating: number, label: FighterLabel = byId): CheckResult {
  const details: string[] = [];
  for (const e of history) {
    if (e.winnerChangedDivision && e.winnerUfcFightsBefore > 0 && e.winnerBefore.rating === initialRating) details.push(`${label(e.winnerId)} (${e.eventDate}, ${e.division})`);
    if (e.loserChangedDivision && e.loserUfcFightsBefore > 0 && e.loserBefore.rating === initialRating) details.push(`${label(e.loserId)} (${e.eventDate}, ${e.division})`);
  }
  return { name: 'Pas de remise à zéro au changement de catégorie', passed: details.length === 0, details };
}

/** `divisions`: each division's eligible fighters, sorted by conservative rating, best first (before the champion display rule). */
export function checkThinNumberOne(divisions: Map<string, RankedFighter[]>, topTenWins: Map<number, number>, label: FighterLabel = byId): CheckResult {
  const details: string[] = [];
  for (const [division, fighters] of Array.from(divisions.entries())) {
    const first = fighters[0];
    if (first && first.ufcFights <= THIN_RECORD_MAX_FIGHTS && (topTenWins.get(first.fighterId) ?? 0) === 0) {
      details.push(`${division} : n°1 = ${label(first.fighterId)} (${first.ufcFights} combats, aucune victoire contre un top ${TOP_N})`);
    }
  }
  return { name: `Aucun n°1 avec ≤ ${THIN_RECORD_MAX_FIGHTS} combats UFC sans victoire contre un top ${TOP_N}`, passed: details.length === 0, details };
}

export function checkDefendingChampions(divisions: Map<string, RankedFighter[]>, titleWins: Map<number, Map<string, number>>, label: FighterLabel = byId): CheckResult {
  const details: string[] = [];
  for (const [division, fighters] of Array.from(divisions.entries())) {
    const index = fighters.findIndex((f) => f.isChampion);
    if (index === -1) continue;
    const defenses = (titleWins.get(fighters[index].fighterId)?.get(division) ?? 0) - 1;
    if (defenses >= 1 && index >= 3) details.push(`${division} : champion ${label(fighters[index].fighterId)} (${defenses} défense(s)) classé ${index + 1}e`);
  }
  return { name: 'Un champion qui a défendu sa ceinture est dans le top 3 de sa catégorie', passed: details.length === 0, details };
}

export function checkPoundForPoundNumberOne(p4p: RankedFighter[], titleWins: Map<number, Map<string, number>>, label: FighterLabel = byId): CheckResult {
  const first = p4p[0];
  const wins = first ? Array.from(titleWins.get(first.fighterId)?.values() ?? []).reduce((a, b) => a + b, 0) : 0;
  return {
    name: 'Le n°1 P4P a gagné au moins un combat de titre',
    passed: !first || wins > 0,
    details: first && wins === 0 ? [`n°1 P4P = ${label(first.fighterId)}, aucun combat de titre gagné`] : [],
  };
}
