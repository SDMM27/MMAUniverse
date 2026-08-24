// data/lib/scoring.ts
import type { MethodCategory } from './definitions';
import { normalizeMethodCategory } from './method-category';

export type PickInput = {
  predicted_winner_id: number;
  predicted_method_category: MethodCategory;
  predicted_round: number | null;
};

export type FightResult = {
  winner_id: number | null;
  method: string;
  round: number;
};

/**
 * +10 for the right winner, +5 more if the method category also matches,
 * +5 more if the round also matches (only possible when the method isn't
 * a decision). A draw/no-contest (winner_id === null) always scores 0 —
 * it was never an option the pick UI offered. See the pick'em design doc's
 * "Scoring" section for the full rule table.
 */
export function scorePick(pick: PickInput, result: FightResult): number {
  if (result.winner_id === null) return 0;
  if (pick.predicted_winner_id !== result.winner_id) return 0;

  let points = 10;
  const actualCategory = normalizeMethodCategory(result.method);
  if (pick.predicted_method_category === actualCategory) {
    points += 5;
    if (actualCategory !== 'decision' && pick.predicted_round === result.round) {
      points += 5;
    }
  }
  return points;
}
