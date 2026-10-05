// data/lib/rating/dominance-score.ts
//
// Per-fight dominance score for the FightScore point-flow engine (see
// docs/superpowers/specs/2026-09-14-fighter-rating-algorithm-design.md,
// "Score de dominance par combat"). Round-by-round-driven, not
// method-weight-driven: a decision won by sweeping every round scores
// comparably to a finish on the roundsWonShare term, while method still
// carries real weight of its own via bonus_finish -- a fighter who finishes
// opponents outright is *also* dominant, independent of whether the earlier
// rounds were already won on the cards. Both fixes (round-sweeping decisions
// aren't undervalued vs. an ordinary decision; finishes still score above an
// equally-dominant decision) hold at once because bonus_finish is 0 for any
// decision rather than a flat per-method multiplier applied to everything.
import { normalizeMethodCategory } from '../method-category';

export type RoundStatsSide = {
  round: number;
  sigStrikesLanded: number;
  controlTimeSeconds: number | null;
  knockdowns: number;
};

export type FightStatsSide = {
  method: string; // raw method string, normalized via normalizeMethodCategory
  finishRound: number | null; // null for a decision
  sigStrikesLandedTotal: number;
  controlTimeSecondsTotal: number | null;
  rounds: RoundStatsSide[]; // one entry per round actually fought, in order
  // UFC bonuses the fight earned (fight-level: read off the winner's side).
  bonusFightOfTheNight?: boolean;
  bonusPerformanceOfTheNight?: boolean; // Performance, and the legacy KO / Submission of the Night
};

export type DominanceResult = { score: number; estimated: boolean };

const WEIGHT_BONUS_FINISH = 0.3;
const WEIGHT_ROUNDS_WON_SHARE = 0.35;
const WEIGHT_STRIKE_DIFFERENTIAL = 0.2;
const WEIGHT_CONTROL_DIFFERENTIAL = 0.15;

// Judges' verdict on a decision (UFCStats: "Decision - Split" etc.): a split or
// majority decision is a win the officials themselves saw as close, whatever
// our stat-based round estimate says. Subtracted from the dominance of the win.
const DECISION_PENALTY_SPLIT = 0.1;
const DECISION_PENALTY_MAJORITY = 0.05;

// UFC's own bonuses, as a judgment of quality that raw stats can't capture: a
// Performance of the Night is a win the UFC singled out as outstanding, a
// Fight of the Night one that was won against a game opponent in a great fight.
const BONUS_PERFORMANCE = 0.1;
const BONUS_FIGHT = 0.05;

// A round tie within this relative margin splits 0.5/0.5 rather than being
// awarded outright -- two fighters producing near-identical output in a
// round shouldn't have one of them "win" it on a rounding accident.
const ROUND_TIE_MARGIN = 0.05;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function computeBonusFinish(method: string): number {
  const category = normalizeMethodCategory(method);
  if (category === 'ko_tko') return 1.0;
  if (category === 'submission') return 0.9;
  return 0; // decision, and 'other' (DQ / unrecognized) -- no finish credit
}

function computeDecisionPenalty(method: string): number {
  const normalized = method.trim().toLowerCase();
  if (!normalized.startsWith('decision')) return 0;
  if (normalized.includes('split')) return DECISION_PENALTY_SPLIT;
  if (normalized.includes('majority')) return DECISION_PENALTY_MAJORITY;
  return 0; // unanimous, or an unspecified decision
}

function computeBonusCredit(winner: FightStatsSide): number {
  return (winner.bonusPerformanceOfTheNight ? BONUS_PERFORMANCE : 0) + (winner.bonusFightOfTheNight ? BONUS_FIGHT : 0);
}

function computeRoundScore(round: RoundStatsSide): number {
  return round.sigStrikesLanded + 0.5 * ((round.controlTimeSeconds ?? 0) / 60) + 5 * round.knockdowns;
}

/** 1 if the winner's side produced more in this round, 0 if the loser's did, 0.5 if within ROUND_TIE_MARGIN of each other. */
function roundCreditForWinner(winnerRound: RoundStatsSide, loserRound: RoundStatsSide): number {
  const winnerScore = computeRoundScore(winnerRound);
  const loserScore = computeRoundScore(loserRound);
  const larger = Math.max(winnerScore, loserScore);
  if (larger === 0) return 0.5; // both sides had zero recorded output this round
  if (Math.abs(winnerScore - loserScore) / larger <= ROUND_TIE_MARGIN) return 0.5;
  return winnerScore > loserScore ? 1 : 0;
}

/** A fighter's share of a two-sided total, 0.5 when both sides are zero (no signal either way). */
function shareOf(winnerValue: number, loserValue: number): number {
  const sum = winnerValue + loserValue;
  return sum === 0 ? 0.5 : winnerValue / sum;
}

/**
 * Computes the winner's dominance score (0-1) for one finished fight.
 * `estimated: true` when round-by-round data isn't available (an older
 * combat not yet covered by the UFCStats round-by-round backfill, or a
 * matching anomaly) -- falls back to method alone: bonus_finish for a
 * finish, a flat 0.4 for a decision (the pre-round-by-round behavior),
 * since there's nothing else to go on. Both paths then apply the decision-type
 * penalty (split / majority) and the UFC bonus credit (Performance / Fight of the Night).
 */
export function computeDominanceScore(winner: FightStatsSide, loser: FightStatsSide): DominanceResult {
  const bonusFinish = computeBonusFinish(winner.method);
  const roundsFought = Math.min(winner.rounds.length, loser.rounds.length);

  if (roundsFought === 0) {
    const category = normalizeMethodCategory(winner.method);
    const base = category === 'decision' ? 0.4 : bonusFinish;
    return { score: clamp01(base - computeDecisionPenalty(winner.method) + computeBonusCredit(winner)), estimated: true };
  }

  let roundsWonByWinner = 0;
  for (let i = 0; i < roundsFought; i++) {
    const winnerRound = winner.rounds[i];
    const loserRound = loser.rounds[i];
    const isFinishRound = winner.finishRound !== null && winnerRound.round === winner.finishRound;
    roundsWonByWinner += isFinishRound ? 1 : roundCreditForWinner(winnerRound, loserRound);
  }
  const roundsWonShare = roundsWonByWinner / roundsFought;

  const strikeDifferential = shareOf(winner.sigStrikesLandedTotal, loser.sigStrikesLandedTotal);
  const controlDifferential = shareOf(winner.controlTimeSecondsTotal ?? 0, loser.controlTimeSecondsTotal ?? 0);

  const score =
    bonusFinish * WEIGHT_BONUS_FINISH +
    roundsWonShare * WEIGHT_ROUNDS_WON_SHARE +
    strikeDifferential * WEIGHT_STRIKE_DIFFERENTIAL +
    controlDifferential * WEIGHT_CONTROL_DIFFERENTIAL;

  return { score: clamp01(score - computeDecisionPenalty(winner.method) + computeBonusCredit(winner)), estimated: false };
}
