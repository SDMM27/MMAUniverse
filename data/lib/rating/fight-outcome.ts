// data/lib/rating/fight-outcome.ts
//
// "How and when does it end?" on top of predictFight's "who wins?". Pure
// functions, no DB access. Three stages, so the six outcomes (A or B, by
// KO/TKO, submission or decision) always add up to predictFight's win odds:
//
//   P(A by method m in round r) = P(A wins) x P(m | A wins) x P(r | m)
//
// P(m | winner, loser): the division's method mix (5-round fights end
// differently, hence its own factor), moved toward how the winner usually
// wins and how the loser usually loses -- each tally shrunk toward the
// division mix so a 2-fight record barely moves it. P(r | finish): the
// UFC-wide round distribution for that method and fight length, tilted
// earlier or later by how early both fighters' past finishes came.
// Constants and priors come from `npm run tune:outcome`
// (data/ml-models/fight-outcome-model.json), validated on held-out fights.

export type FinishMethod = 'ko' | 'sub' | 'dec';
export const FINISH_METHODS: FinishMethod[] = ['ko', 'sub', 'dec'];

export type MethodTally = Record<FinishMethod, number>;
export type MethodMix = Record<FinishMethod, number>; // shares adding up to 1

// How a fighter's past fights ended. Counts may be fractional: non-UFC
// fights (Sherdog) are counted at `externalWeight` of a UFC fight.
export type OutcomeProfile = {
  wins: MethodTally;
  losses: MethodTally;
  // Finished fights only (KO/TKO or submission), for the round model.
  finishWins: { count: number; roundSum: number };
  finishLosses: { count: number; roundSum: number };
};

export type FightOutcomeParams = {
  shrinkage: number; // pseudo-fights of division mix added to each tally
  winnerWeight: number; // how far P(method) follows the winner's way of winning
  loserWeight: number; // ... the loser's way of losing
  crossWeight: number; // ... the winner's losses and the loser's wins (fights that go long, or don't)
  roundShrinkage: number; // pseudo-finishes at the UFC-wide mean finish round
  roundTilt: number; // per-round log-odds shift per round of "later than usual" finishing
  externalWeight: number; // a non-UFC fight counts as this share of a UFC fight
};

export type FightOutcomeModel = {
  params: FightOutcomeParams;
  globalMix: MethodMix; // 3-round fights, all divisions
  divisionMix: Record<string, MethodMix>; // 3-round fights, shrunk toward globalMix
  fiveRoundFactor: MethodMix; // multiply then renormalize for a 5-round fight
  // roundShares[scheduledRounds][method][r - 1]: share of finishes in round r.
  roundShares: Record<'3' | '5', Record<'ko' | 'sub', number[]>>;
  meanFinishRound: number; // across every finish, the baseline for roundTilt
};

export type OutcomeContext = { division: string | null; scheduledRounds: 3 | 5 };

export const emptyProfile = (): OutcomeProfile => ({
  wins: { ko: 0, sub: 0, dec: 0 },
  losses: { ko: 0, sub: 0, dec: 0 },
  finishWins: { count: 0, roundSum: 0 },
  finishLosses: { count: 0, roundSum: 0 },
});

// UFCStats and Sherdog spell methods differently; null for anything that isn't
// a clean win (DQ, overturned, could not continue, draws, no contests).
export function classifyMethod(rawMethod: string | null | undefined): FinishMethod | null {
  if (!rawMethod) return null;
  const method = rawMethod.trim();
  if (/^(Technical )?Decision/i.test(method)) return 'dec';
  if (/^(Technical )?Submission/i.test(method)) return 'sub';
  if (/^(T?KO)\b|^KO\/TKO|Doctor/i.test(method)) return 'ko';
  return null;
}

// Adds one past fight to a profile (weight 1 for UFC, externalWeight otherwise).
export function addFight(profile: OutcomeProfile, won: boolean, method: FinishMethod, finishRound: number | null, weight = 1) {
  (won ? profile.wins : profile.losses)[method] += weight;
  if (method !== 'dec' && finishRound && finishRound > 0) {
    const finishes = won ? profile.finishWins : profile.finishLosses;
    finishes.count += weight;
    finishes.roundSum += weight * finishRound;
  }
}

export function combineProfiles(ufc: OutcomeProfile, external: OutcomeProfile, externalWeight: number): OutcomeProfile {
  const tally = (a: MethodTally, b: MethodTally): MethodTally => ({ ko: a.ko + externalWeight * b.ko, sub: a.sub + externalWeight * b.sub, dec: a.dec + externalWeight * b.dec });
  const finishes = (a: OutcomeProfile['finishWins'], b: OutcomeProfile['finishWins']) => ({ count: a.count + externalWeight * b.count, roundSum: a.roundSum + externalWeight * b.roundSum });
  return {
    wins: tally(ufc.wins, external.wins),
    losses: tally(ufc.losses, external.losses),
    finishWins: finishes(ufc.finishWins, external.finishWins),
    finishLosses: finishes(ufc.finishLosses, external.finishLosses),
  };
}

function normalize(weights: MethodMix): MethodMix {
  const total = weights.ko + weights.sub + weights.dec;
  return { ko: weights.ko / total, sub: weights.sub / total, dec: weights.dec / total };
}

// The method mix a fight starts from before looking at who's in it. A
// catchweight or cross-division matchup (division null or two divisions)
// averages what it's given.
export function contextMix(model: FightOutcomeModel, divisions: (string | null)[], scheduledRounds: 3 | 5): MethodMix {
  const mixes = divisions.map((d) => (d && model.divisionMix[d]) || model.globalMix);
  const averaged = FINISH_METHODS.reduce((acc, m) => ({ ...acc, [m]: mixes.reduce((s, mix) => s + mix[m], 0) / mixes.length }), {} as MethodMix);
  if (scheduledRounds === 3) return averaged;
  return normalize({ ko: averaged.ko * model.fiveRoundFactor.ko, sub: averaged.sub * model.fiveRoundFactor.sub, dec: averaged.dec * model.fiveRoundFactor.dec });
}

// log(shrunk share / prior) for each method -- 0 everywhere for an empty tally.
function tallyLift(tally: MethodTally, prior: MethodMix, shrinkage: number): MethodMix {
  const total = tally.ko + tally.sub + tally.dec;
  const lift = (m: FinishMethod) => Math.log((tally[m] + shrinkage * prior[m]) / (total + shrinkage) / prior[m]);
  return { ko: lift('ko'), sub: lift('sub'), dec: lift('dec') };
}

const sumTallies = (a: MethodTally, b: MethodTally): MethodTally => ({ ko: a.ko + b.ko, sub: a.sub + b.sub, dec: a.dec + b.dec });

/** P(method | `winner` beats `loser`), starting from `prior` (see contextMix). */
export function predictMethod(winner: OutcomeProfile, loser: OutcomeProfile, prior: MethodMix, params: FightOutcomeParams): MethodMix {
  const { shrinkage, winnerWeight, loserWeight, crossWeight } = params;
  const winnerWays = tallyLift(winner.wins, prior, shrinkage);
  const loserWays = tallyLift(loser.losses, prior, shrinkage);
  // The other half of each record: a winner who only ever loses on the
  // cards, or a loser whose own wins all go the distance, says "long fight".
  const cross = tallyLift(sumTallies(winner.losses, loser.wins), prior, shrinkage);
  const weights = FINISH_METHODS.reduce(
    (acc, m) => ({ ...acc, [m]: prior[m] * Math.exp(winnerWeight * winnerWays[m] + loserWeight * loserWays[m] + crossWeight * cross[m]) }),
    {} as MethodMix,
  );
  return normalize(weights);
}

/** P(round r | the fight is finished by `method`), r = 1..scheduledRounds. */
export function predictFinishRound(
  winner: OutcomeProfile,
  loser: OutcomeProfile,
  method: 'ko' | 'sub',
  scheduledRounds: 3 | 5,
  model: FightOutcomeModel,
): number[] {
  const { roundShrinkage, roundTilt } = model.params;
  const base = model.roundShares[String(scheduledRounds) as '3' | '5'][method];
  // How much later than usual these two fighters' finishes (given and taken) came, in rounds.
  const count = winner.finishWins.count + loser.finishLosses.count;
  const roundSum = winner.finishWins.roundSum + loser.finishLosses.roundSum;
  const lateness = (roundSum + roundShrinkage * model.meanFinishRound) / (count + roundShrinkage) - model.meanFinishRound;
  const weights = base.map((share, i) => share * Math.exp(roundTilt * lateness * i));
  const total = weights.reduce((s, w) => s + w, 0);
  return weights.map((w) => w / total);
}

export type OutcomeLine = {
  corner: 'A' | 'B';
  method: FinishMethod;
  probability: number; // of this exact (winner, method), all six add up to 1
  // For a finish: probability of it happening in each round (adds up to `probability`).
  // Empty for a decision (it goes the distance).
  byRound: number[];
};

/**
 * The six (winner, method) outcomes with their round split, given P(A wins)
 * from predictFight. Draws and no contests (~2% of UFC fights) aren't
 * modelled: the six lines add up to 1.
 */
export function predictOutcomes(
  winA: number,
  a: OutcomeProfile,
  b: OutcomeProfile,
  prior: MethodMix,
  scheduledRounds: 3 | 5,
  model: FightOutcomeModel,
): OutcomeLine[] {
  const lines: OutcomeLine[] = [];
  for (const [corner, winner, loser, pWin] of [['A', a, b, winA], ['B', b, a, 1 - winA]] as const) {
    const methods = predictMethod(winner, loser, prior, model.params);
    for (const method of FINISH_METHODS) {
      const probability = pWin * methods[method];
      const byRound = method === 'dec' ? [] : predictFinishRound(winner, loser, method, scheduledRounds, model).map((share) => share * probability);
      lines.push({ corner, method, probability, byRound });
    }
  }
  return lines;
}
