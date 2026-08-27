import { FighterStats } from './definitions';

type ScorableFight = {
  method: string | null;
  // 'nc' (no contest) falls through untallied below, same as 'upcoming' —
  // neither counts toward a fighter's win/loss/draw record.
  result: 'win' | 'loss' | 'draw' | 'nc' | 'upcoming';
};

function categorizeMethod(method: string | null | undefined): 'ko' | 'submission' | 'decision' | 'other' {
  const normalized = (method ?? '').trim().toLowerCase();
  if (normalized.includes('ko')) return 'ko'; // catches both "KO" and "TKO"
  if (normalized.includes('sub')) return 'submission';
  if (normalized.includes('dec')) return 'decision';
  return 'other';
}

export function computeFighterStats(fights: ScorableFight[]): FighterStats {
  const stats: FighterStats = { wins: 0, losses: 0, draws: 0, ko: 0, submission: 0, decision: 0 };

  for (const fight of fights) {
    if (fight.result === 'win') {
      stats.wins += 1;
      const category = categorizeMethod(fight.method);
      if (category === 'ko') stats.ko += 1;
      if (category === 'submission') stats.submission += 1;
      if (category === 'decision') stats.decision += 1;
    } else if (fight.result === 'loss') {
      stats.losses += 1;
    } else if (fight.result === 'draw') {
      stats.draws += 1;
    }
  }

  return stats;
}
