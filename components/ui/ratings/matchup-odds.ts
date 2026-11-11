import { SimulatorFighter } from '@/data/lib/definitions';
import { predictFight } from '@/data/lib/rating/simulate-fight';
import { predictMatchup } from '@/data/lib/rating/matchup-model';
import { MATCHUP_MODEL } from '@/data/lib/rating/matchup-model-tuned';

// The simulator's win probability (FightScore level + matchup layer), in one
// place so the home page's face-off and /simulateur show the same numbers.
// Only wires the existing models together; it computes nothing of its own.
export function matchupOdds(a: SimulatorFighter, b: SimulatorFighter) {
  const rating = predictFight({ rating: a.rating, rd: a.rd }, { rating: b.rating, rd: b.rd });
  const prediction = predictMatchup(rating.winA, a.matchup_profile, b.matchup_profile, MATCHUP_MODEL);
  const pctA = Math.round(prediction.winA * 100);
  return { rating, prediction, pctA, pctB: 100 - pctA };
}
