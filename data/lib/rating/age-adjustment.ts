// data/lib/rating/age-adjustment.ts
//
// The fight simulator's age layer, on top of predictFight's Glicko odds. The
// rating only sees past results, so it can't anticipate a veteran's decline:
// on the 2023-06+ holdout the younger fighter won 70.6% of fights with a 6+
// year age gap where the rating said 50.1% (.diag/win-diag.ts, 2026-10-08).
//
//   P(A) = sigmoid(ratingWeight * logit(predictFight)
//                  + ageGapWeight * (ageA - ageB) / 5
//                  + veteranWeight * (yearsOver(A) - yearsOver(B)) / 5)
//
// yearsOver = years past veteranAge. No intercept and every term flips sign
// with the corners, so P(A) + P(B) = 1 whichever corner you call A. The
// weights come from `npm run tune:age` (data/ml-models/fight-age-model.json).
// Pure functions.

export type AgeAdjustmentModel = {
  ratingWeight: number; // recalibrates the Glicko odds themselves
  ageGapWeight: number; // per 5 years of age difference (negative: older is worse)
  veteranWeight: number; // per 5 years past veteranAge (extra decline)
  veteranAge: number;
};

export type AgeFeatures = { logit: number; ageGap: number; veteran: number };

const logit = (p: number) => Math.log(p / (1 - p));
const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

/** Features for A vs B, oriented so that a positive value describes A. Ages in years; null when unknown. */
export function ageFeatures(ratingWinA: number, ageA: number | null, ageB: number | null, veteranAge: number): AgeFeatures {
  const p = Math.min(Math.max(ratingWinA, 1e-9), 1 - 1e-9);
  if (ageA == null || ageB == null) return { logit: logit(p), ageGap: 0, veteran: 0 };
  const over = (age: number) => Math.max(age - veteranAge, 0);
  return { logit: logit(p), ageGap: (ageA - ageB) / 5, veteran: (over(ageA) - over(ageB)) / 5 };
}

export function scoreFeatures(f: AgeFeatures, model: AgeAdjustmentModel): number {
  return sigmoid(model.ratingWeight * f.logit + model.ageGapWeight * f.ageGap + model.veteranWeight * f.veteran);
}

export type AgeAdjustedPrediction = {
  winA: number; // with age, what the simulator shows
  withoutAge: number; // same model with the age terms off: what age changed is winA - withoutAge
  ageKnown: boolean;
};

export function adjustForAge(ratingWinA: number, ageA: number | null, ageB: number | null, model: AgeAdjustmentModel): AgeAdjustedPrediction {
  const f = ageFeatures(ratingWinA, ageA, ageB, model.veteranAge);
  return {
    winA: scoreFeatures(f, model),
    withoutAge: scoreFeatures({ ...f, ageGap: 0, veteran: 0 }, model),
    ageKnown: ageA != null && ageB != null,
  };
}

/**
 * Fits the three weights by Newton's method on log-loss with a small L2 on
 * the age terms (pulling them toward 0, not ratingWeight toward 0). Each
 * sample is A's features and whether A won.
 */
export function fitAgeAdjustment(samples: { features: AgeFeatures; aWon: boolean }[], veteranAge: number, l2 = 1): AgeAdjustmentModel {
  const x = samples.map((s) => [s.features.logit, s.features.ageGap, s.features.veteran]);
  const prior = [1, 0, 0];
  let w = [...prior];
  for (let iter = 0; iter < 50; iter++) {
    const grad = [0, 0, 0];
    const hess = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];
    samples.forEach((s, i) => {
      const p = sigmoid(w[0] * x[i][0] + w[1] * x[i][1] + w[2] * x[i][2]);
      for (let a = 0; a < 3; a++) {
        grad[a] += (p - (s.aWon ? 1 : 0)) * x[i][a];
        for (let b = 0; b < 3; b++) hess[a][b] += p * (1 - p) * x[i][a] * x[i][b];
      }
    });
    for (let a = 0; a < 3; a++) {
      grad[a] += l2 * (w[a] - prior[a]);
      hess[a][a] += l2;
    }
    const step = solve3(hess, grad);
    w = w.map((v, i) => v - step[i]);
    if (Math.max(...step.map(Math.abs)) < 1e-10) break;
  }
  return { ratingWeight: w[0], ageGapWeight: w[1], veteranWeight: w[2], veteranAge };
}

function solve3(a: number[][], b: number[]): number[] {
  const m = a.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < 3; c++) {
    let p = c;
    for (let r = c + 1; r < 3; r++) if (Math.abs(m[r][c]) > Math.abs(m[p][c])) p = r;
    [m[c], m[p]] = [m[p], m[c]];
    for (let r = 0; r < 3; r++) {
      if (r === c) continue;
      const f = m[r][c] / m[c][c];
      for (let j = c; j <= 3; j++) m[r][j] -= f * m[c][j];
    }
  }
  return m.map((row, i) => row[3] / row[i]);
}
