import { normalizeMethodCategory } from './method-category';
import { FighterStats, MethodBreakdown, MethodCategory } from './definitions';

type ScorableFight = {
  method: string | null;
  // 'nc' (no contest) falls through untallied below, same as 'upcoming' —
  // neither counts toward a fighter's win/loss/draw record.
  result: 'win' | 'loss' | 'draw' | 'nc' | 'upcoming';
};

function emptyMethodBreakdown(): MethodBreakdown {
  return { koTko: 0, submission: 0, decision: 0 };
}

// Bucket a win/loss by method category. Categories other than the three
// trackable ones (e.g. disqualification, an unresolvable "No Contest" method
// string) still count toward the fighter's win/loss total via the caller —
// they're just not represented in any method bucket, so the three buckets
// can sum to less than the total.
function tally(target: MethodBreakdown, category: MethodCategory | 'other'): void {
  if (category === 'ko_tko') target.koTko += 1;
  else if (category === 'submission') target.submission += 1;
  else if (category === 'decision') target.decision += 1;
}

export function computeFighterStats(fights: ScorableFight[]): FighterStats {
  const stats: FighterStats = {
    wins: 0,
    losses: 0,
    draws: 0,
    winMethods: emptyMethodBreakdown(),
    lossMethods: emptyMethodBreakdown(),
  };

  for (const fight of fights) {
    if (fight.result === 'win') {
      stats.wins += 1;
      tally(stats.winMethods, normalizeMethodCategory(fight.method ?? ''));
    } else if (fight.result === 'loss') {
      stats.losses += 1;
      tally(stats.lossMethods, normalizeMethodCategory(fight.method ?? ''));
    } else if (fight.result === 'draw') {
      stats.draws += 1;
    }
  }

  return stats;
}
