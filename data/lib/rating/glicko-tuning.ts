// data/lib/rating/glicko-tuning.ts
//
// The Glicko counterpart of collectWinnerLogRatios (./point-flow-tuning.ts):
// per fight, the pre-fight winner-minus-loser rating gap, strictly
// point-in-time, split chronologically into train/test. Scored with the same
// fitScale/evaluateLogRatios (sigmoid(k * gap)), so the log-loss is directly
// comparable with the point flow's 0.6767 on the same held-out fights.
import { simulateCareerRatings, type CareerFightInput, type CareerNoResultInput } from './simulate-career';
import type { GlickoParams } from './glicko-rating';

export type CareerDiffSplit = {
  train: number[];
  test: number[];
  // Test fights where either fighter had already fought in another UFC weight class.
  testMovers: number[];
};

export function collectCareerRatingDiffs(
  fights: CareerFightInput[],
  noResults: CareerNoResultInput[],
  params: GlickoParams,
  testFromDate: string,
  initialRatingOf?: (fighterId: number, debutDateIso: string) => number,
): CareerDiffSplit {
  const split: CareerDiffSplit = { train: [], test: [], testMovers: [] };
  const divisionsSeen = new Map<number, Set<string>>();
  const { history } = simulateCareerRatings(fights, noResults, params, initialRatingOf);
  for (const entry of history) {
    const x = entry.winnerBefore.rating - entry.loserBefore.rating;
    const mover = [entry.winnerId, entry.loserId].some((id) => Array.from(divisionsSeen.get(id) ?? []).some((d) => d !== entry.division));
    if (entry.eventDate < testFromDate) split.train.push(x);
    else {
      split.test.push(x);
      if (mover) split.testMovers.push(x);
    }
    for (const id of [entry.winnerId, entry.loserId]) {
      const seen = divisionsSeen.get(id) ?? new Set<string>();
      seen.add(entry.division);
      divisionsSeen.set(id, seen);
    }
  }
  return split;
}
