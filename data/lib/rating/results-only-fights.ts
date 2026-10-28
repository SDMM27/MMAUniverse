// data/lib/rating/results-only-fights.ts
//
// UFC fights that have a result but no UFCStats stat line -- everything after
// the UFCStats scraper was removed on 2026-10-28 -- turned into FightScore
// career inputs from the site's own `fights` table (Sherdog results): winner,
// method, round, weight class. With no rounds, computeDominanceScore takes its
// method-only path (`estimated: true`): finish credit for a KO/submission, a
// flat 0.4 for a decision, minus the split/majority penalty; no UFC bonuses.
// Measured on 1,667 held-out fights (2026-10-28): same log-loss as with full
// stats, accuracy 59.75% -> 59.27%, within noise.
//
// These fights only feed the Glicko rating (FightScore itself). Style
// archetypes, the win predictor and the analyses keep reading real stats.
import type { FightStatsSide } from './dominance-score';
import { normalizeWeightClass } from './normalize-weight-class';
import type { CareerFightInput, CareerNoResultInput } from './simulate-career';

export type ResultOnlyFightRow = {
  fight_id: number;
  event_date: string; // ISO 'YYYY-MM-DD'
  weight_class: string | null;
  method: string | null;
  round: number | null;
  winner_id: number | null;
  fighter1_id: number;
  fighter2_id: number;
  is_title_fight: boolean | null;
  is_main_event: boolean | null;
  is_women: boolean; // either fighter -- Sherdog labels a women's bout "Bantamweight"
};

// Division limits (lb), for Sherdog's "157lb Catchweight" labels: UFCStats
// usually filed those under the nearest division (Ribovics' 157lb bout on
// 2026-10-03 is "Lightweight" there), so a catchweight win still counts.
const MEN_LIMITS: [number, string][] = [
  [125, 'Flyweight'], [135, 'Bantamweight'], [145, 'Featherweight'], [155, 'Lightweight'],
  [170, 'Welterweight'], [185, 'Middleweight'], [205, 'Light Heavyweight'], [265, 'Heavyweight'],
];
const WOMEN_LIMITS: [number, string][] = [
  [115, "Women's Strawweight"], [125, "Women's Flyweight"], [135, "Women's Bantamweight"], [145, "Women's Featherweight"],
];

/** Sherdog's weight class, prefixed "Women's" for a women's bout, then canonicalized; a catchweight goes to the nearest division's limit (null when there's no weight to go on). */
export function resultOnlyDivision(row: Pick<ResultOnlyFightRow, 'weight_class' | 'is_women'>): string | null {
  const raw = (row.weight_class ?? '').trim();
  const labelled = row.is_women && !/^women/i.test(raw) ? `Women's ${raw}` : raw;
  const canonical = normalizeWeightClass(labelled);
  if (canonical) return canonical;
  const pounds = /^(\d{3})\s*lb\s*catch\s*weight$/i.exec(raw.replace(/\s+/g, ' '))?.[1];
  if (!pounds) return null;
  const weight = Number(pounds);
  const limits = row.is_women ? WOMEN_LIMITS : MEN_LIMITS;
  let best = limits[0];
  for (const limit of limits) if (Math.abs(limit[0] - weight) < Math.abs(best[0] - weight)) best = limit;
  return best[1];
}

const NO_RESULT_METHOD = /^(draw|no contest|nc)\b/i;

function resultOnlySide(method: string, round: number | null): FightStatsSide {
  const isDecision = method.trim().toLowerCase().startsWith('decision');
  return {
    method,
    finishRound: isDecision ? null : round,
    sigStrikesLandedTotal: 0,
    controlTimeSecondsTotal: null,
    rounds: [],
  };
}

export function resultsOnlyCareerInputs(rows: ResultOnlyFightRow[]): {
  fights: CareerFightInput[];
  noResults: CareerNoResultInput[];
  skippedUnmatchedDivision: number;
  skippedNoResult: number; // no winner, yet not a draw / no contest either: an incomplete row, not guessed at
} {
  const fights: CareerFightInput[] = [];
  const noResults: CareerNoResultInput[] = [];
  let skippedUnmatchedDivision = 0;
  let skippedNoResult = 0;
  for (const row of rows) {
    const division = resultOnlyDivision(row);
    if (!division) {
      skippedUnmatchedDivision++;
      continue;
    }
    const method = row.method ?? '';
    if (row.winner_id === null) {
      if (!NO_RESULT_METHOD.test(method.trim())) {
        skippedNoResult++;
        continue;
      }
      // No winner: a draw ends a streak, a no contest doesn't; both count as activity.
      noResults.push({ eventDate: row.event_date, fighterIds: [row.fighter1_id, row.fighter2_id], isDraw: /^draw/i.test(method.trim()), division });
      continue;
    }
    const loserId = row.winner_id === row.fighter1_id ? row.fighter2_id : row.fighter1_id;
    fights.push({
      fightUrl: `fights:${row.fight_id}`,
      eventDate: row.event_date,
      division,
      isTitleFight: row.is_title_fight ?? false,
      isFiveRounds: Boolean(row.is_title_fight || row.is_main_event),
      winnerId: row.winner_id,
      loserId,
      winnerSide: resultOnlySide(method, row.round),
      loserSide: resultOnlySide(method, row.round),
    });
  }
  return { fights, noResults, skippedUnmatchedDivision, skippedNoResult };
}
