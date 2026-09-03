// data/lib/ranking-utils.ts
import { RankingWithFighter } from './definitions';

export type WeightClassGroup = {
  weightClass: string;
  champion: RankingWithFighter | null; // rank 0, if present
  contenders: RankingWithFighter[]; // rank 1-15, in rank order
};

/**
 * Groups a flat rankings list (as returned by fetchRankingsByOrg, already
 * ordered by insertion order -- see that function's doc comment) into one
 * entry per weight_class, preserving the order weight classes first appear
 * in rather than re-sorting alphabetically.
 */
export function groupRankingsByWeightClass(rankings: RankingWithFighter[]): WeightClassGroup[] {
  const groups = new Map<string, WeightClassGroup>();
  for (const ranking of rankings) {
    let group = groups.get(ranking.weight_class);
    if (!group) {
      group = { weightClass: ranking.weight_class, champion: null, contenders: [] };
      groups.set(ranking.weight_class, group);
    }
    if (ranking.rank === 0) {
      group.champion = ranking;
    } else {
      group.contenders.push(ranking);
    }
  }
  return Array.from(groups.values());
}
