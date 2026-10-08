// data/lib/rating/matchup-model.ts
//
// The fight simulator's matchup layer, on top of predictFight's Glicko odds.
// The rating only knows who beat whom; this adds what it can't see, each
// factor kept only if it improved held-out log-loss in all four test windows
// (2017-18, 2019-20, 2021-23, 2023+) of the 2026-10-08 feature search
// (.diag/feature-search.ts):
//   - age: the younger fighter wins far more than the rating says, more so
//     once the older one is past veteranAge,
//   - strikes: significant strikes landed minus absorbed per minute in the UFC,
//   - control: share of the control time in their UFC fights,
//   - knockdowns: knockdowns absorbed per 15 minutes,
//   - layoff: coming back after more than longLayoffMonths without a fight,
//   - reach.
// Career rates are shrunk toward the UFC average by priorMinutes of cage time,
// so a debutant's few minutes don't swing the odds.
//
//   P(A) = sigmoid(w.rating * logit(predictFight) + sum of w.factor * (A - B))
//
// No intercept and every term flips sign with the corners, so P(A) + P(B) = 1
// whichever corner you call A. Weights from `npm run tune:matchup`
// (data/ml-models/fight-matchup-model.json). Pure functions.

// Everything the layer needs about one fighter, as of fight night. Raw career
// sums from UFCStats (no contests and draws included), shrunk here.
export type MatchupProfile = {
  age: number | null; // years
  reachCm: number | null;
  monthsSinceLastFight: number | null; // null before their first UFC fight
  ufcMinutes: number;
  sigStrikesLanded: number;
  sigStrikesAbsorbed: number;
  controlSeconds: number;
  controlledSeconds: number; // opponents' control time against them
  knockdownsAbsorbed: number;
};

export const emptyMatchupProfile = (): MatchupProfile => ({
  age: null,
  reachCm: null,
  monthsSinceLastFight: null,
  ufcMinutes: 0,
  sigStrikesLanded: 0,
  sigStrikesAbsorbed: 0,
  controlSeconds: 0,
  controlledSeconds: 0,
  knockdownsAbsorbed: 0,
});

export const MATCHUP_TERMS = ['rating', 'age', 'veteran', 'strikes', 'control', 'knockdowns', 'layoff', 'reach'] as const;
export type MatchupTerm = (typeof MATCHUP_TERMS)[number];

export type MatchupModel = {
  weights: Record<MatchupTerm, number>;
  veteranAge: number;
  longLayoffMonths: number;
  priorMinutes: number;
};

// Shape constants, fixed by the feature search; only the weights (and veteranAge) are tuned.
export const MATCHUP_SHAPE = { longLayoffMonths: 15, priorMinutes: 30 };
const AVERAGE_KNOCKDOWNS_PER_15 = 0.25;

/** Minutes a UFCStats fight lasted, from its finish round and "M:SS" finish time. */
export function fightMinutes(finishRound: number | null, finishTime: string | null): number {
  const [m, s] = (finishTime ?? '5:00').split(':').map(Number);
  return Math.max(0.5, ((finishRound ?? 3) - 1) * 5 + (Number.isFinite(m) ? m + (s || 0) / 60 : 5));
}

export type FightStatLine = { minutes: number; sigStrikesLanded: number; sigStrikesAbsorbed: number; controlSeconds: number; controlledSeconds: number; knockdownsAbsorbed: number };

/** The profile after one more UFC fight (the tuning replay; the site sums the same columns in SQL). */
export function addFightToProfile(profile: MatchupProfile, fight: FightStatLine): MatchupProfile {
  return {
    ...profile,
    ufcMinutes: profile.ufcMinutes + fight.minutes,
    sigStrikesLanded: profile.sigStrikesLanded + fight.sigStrikesLanded,
    sigStrikesAbsorbed: profile.sigStrikesAbsorbed + fight.sigStrikesAbsorbed,
    controlSeconds: profile.controlSeconds + fight.controlSeconds,
    controlledSeconds: profile.controlledSeconds + fight.controlledSeconds,
    knockdownsAbsorbed: profile.knockdownsAbsorbed + fight.knockdownsAbsorbed,
  };
}

/** Shrunk career rates, as the model reads them (and the simulator shows them). */
export function profileRates(p: MatchupProfile, priorMinutes: number) {
  const prior = priorMinutes * 60;
  return {
    strikeDiffPerMin: (p.sigStrikesLanded - p.sigStrikesAbsorbed) / (p.ufcMinutes + priorMinutes),
    controlShare: (p.controlSeconds + prior / 2) / (p.controlSeconds + p.controlledSeconds + prior),
    knockdownsAbsorbedPer15: ((p.knockdownsAbsorbed + (AVERAGE_KNOCKDOWNS_PER_15 * priorMinutes) / 15) / (p.ufcMinutes + priorMinutes)) * 15,
  };
}

/** The model's inputs for A vs B, each oriented so that a positive value describes A. */
export function matchupFeatures(ratingWinA: number, a: MatchupProfile, b: MatchupProfile, shape: Omit<MatchupModel, 'weights'>): Record<MatchupTerm, number> {
  const p = Math.min(Math.max(ratingWinA, 1e-9), 1 - 1e-9);
  const ra = profileRates(a, shape.priorMinutes);
  const rb = profileRates(b, shape.priorMinutes);
  const agesKnown = a.age != null && b.age != null;
  const over = (age: number) => Math.max(age - shape.veteranAge, 0);
  const longLayoff = (x: MatchupProfile) => (x.monthsSinceLastFight != null && x.monthsSinceLastFight > shape.longLayoffMonths ? 1 : 0);
  return {
    rating: Math.log(p / (1 - p)),
    age: agesKnown ? (a.age! - b.age!) / 5 : 0,
    veteran: agesKnown ? (over(a.age!) - over(b.age!)) / 5 : 0,
    strikes: ra.strikeDiffPerMin - rb.strikeDiffPerMin,
    control: (ra.controlShare - rb.controlShare) * 5,
    knockdowns: (ra.knockdownsAbsorbedPer15 - rb.knockdownsAbsorbedPer15) * 2,
    layoff: longLayoff(a) - longLayoff(b),
    reach: a.reachCm != null && b.reachCm != null ? (a.reachCm - b.reachCm) / 10 : 0,
  };
}

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));
const score = (x: Record<MatchupTerm, number>, w: Record<MatchupTerm, number>) => MATCHUP_TERMS.reduce((z, t) => z + w[t] * x[t], 0);

export function scoreMatchup(x: Record<MatchupTerm, number>, model: MatchupModel): number {
  return sigmoid(score(x, model.weights));
}

// What the simulator explains, one line per factor: age and veteran count as one.
export const MATCHUP_FACTORS = { age: ['age', 'veteran'], strikes: ['strikes'], control: ['control'], knockdowns: ['knockdowns'], layoff: ['layoff'], reach: ['reach'] } as const;
export type MatchupFactor = keyof typeof MATCHUP_FACTORS;

export type MatchupPrediction = {
  winA: number; // what the simulator shows
  ratingOnly: number; // same model with every factor off
  shifts: Record<MatchupFactor, number>; // how much each factor moved P(A): winA minus winA without it
};

export function predictMatchup(ratingWinA: number, a: MatchupProfile, b: MatchupProfile, model: MatchupModel): MatchupPrediction {
  const x = matchupFeatures(ratingWinA, a, b, model);
  const z = score(x, model.weights);
  const winA = sigmoid(z);
  const shifts = {} as Record<MatchupFactor, number>;
  for (const [factor, terms] of Object.entries(MATCHUP_FACTORS) as [MatchupFactor, readonly MatchupTerm[]][]) {
    shifts[factor] = winA - sigmoid(z - terms.reduce((s, t) => s + model.weights[t] * x[t], 0));
  }
  return { winA, ratingOnly: sigmoid(model.weights.rating * x.rating), shifts };
}

/**
 * Fits the weights by Newton's method on log-loss, with an L2 pull toward
 * "the rating alone" (rating 1, every factor 0). `terms` limits the fit to a
 * subset (the others stay 0), for comparisons in the tuning script.
 */
export function fitMatchupWeights(
  samples: { x: Record<MatchupTerm, number>; aWon: boolean }[],
  terms: readonly MatchupTerm[] = MATCHUP_TERMS,
  l2 = 1,
): Record<MatchupTerm, number> {
  const prior: number[] = terms.map((t) => (t === 'rating' ? 1 : 0));
  let w = [...prior];
  const d = terms.length;
  for (let iter = 0; iter < 50; iter++) {
    const grad = new Array(d).fill(0);
    const hess = Array.from({ length: d }, () => new Array(d).fill(0));
    for (const s of samples) {
      const row = terms.map((t) => s.x[t]);
      const p = sigmoid(row.reduce((z, v, j) => z + v * w[j], 0));
      for (let i = 0; i < d; i++) {
        grad[i] += (p - (s.aWon ? 1 : 0)) * row[i];
        for (let j = 0; j < d; j++) hess[i][j] += p * (1 - p) * row[i] * row[j];
      }
    }
    for (let i = 0; i < d; i++) {
      grad[i] += l2 * (w[i] - prior[i]);
      hess[i][i] += l2;
    }
    const step = solve(hess, grad);
    w = w.map((v, i) => v - step[i]);
    if (Math.max(...step.map(Math.abs)) < 1e-10) break;
  }
  const weights = Object.fromEntries(MATCHUP_TERMS.map((t) => [t, 0])) as Record<MatchupTerm, number>;
  terms.forEach((t, i) => (weights[t] = w[i]));
  return weights;
}

function solve(a: number[][], b: number[]): number[] {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(m[r][c]) > Math.abs(m[p][c])) p = r;
    [m[c], m[p]] = [m[p], m[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = m[r][c] / m[c][c];
      for (let j = c; j <= n; j++) m[r][j] -= f * m[c][j];
    }
  }
  return m.map((row, i) => row[n] / row[i]);
}
