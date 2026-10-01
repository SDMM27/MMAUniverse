// data/lib/rating/style-archetype.ts
//
// Fighter style archetype shown on FightScore cards ("Lutteur / contrôleur",
// "Frappeur de distance", ...). Replaces the per-division k-means of
// style-clustering.ts (2026-10-01), which mislabelled fighters in two ways:
//  - a rare event in a small sample defined a style (Alex Pereira labelled
//    "Finisseur soumission" at heavyweight from a single fight, a heavyweight
//    with 7 submission attempts in 3 hours looking like a specialist because
//    almost no heavyweight attempts any);
//  - single-stat axes (submissions, clinch) have a wider spread than the
//    averaged ones (grappling, distance striking), so they won the argmax
//    too often.
// Same method as the style-matchup analysis published from this data:
//  1. career counts, most recent fights weighted more (DECAY per fight);
//  2. each rate shrunk toward the reference pool's average by PRIOR_SECONDS
//     of cage time, so a short UFC career can't produce an extreme rate;
//  3. each rate z-scored within the reference pool, axes built from them,
//     then every axis re-standardized so they all have the same spread;
//  4. the strongest axis wins only if it clears AXIS_THRESHOLD and an
//     absolute floor (~top quarter of UFC careers since 2005) -- otherwise
//     "Polyvalent".

export const STYLE_LABELS = {
  grappling: 'Lutteur / contrôleur',
  submission: 'Spécialiste soumission',
  distance: 'Frappeur de distance',
  power: 'Puncheur (KO)',
  clinch: 'Clincheur / pression',
  balanced: 'Polyvalent',
} as const;

export type StyleLabel = (typeof STYLE_LABELS)[keyof typeof STYLE_LABELS];

/** One fight's raw counts (strikes are landed significant strikes). */
export type StyleSample = {
  seconds: number;
  takedownsLanded: number;
  controlSeconds: number;
  groundLanded: number;
  submissionAttempts: number;
  distanceLanded: number;
  headLanded: number;
  clinchLanded: number;
  knockdowns: number;
  sigLanded: number;
};

export const DECAY = 0.9; // a fight's weight halves every ~6.5 fights
export const PRIOR_SECONDS = 45 * 60;
export const AXIS_THRESHOLD = 0.6;
export const MIN_FIGHTS = 3;
export const MIN_SECONDS = 15 * 60;

type Axis = Exclude<keyof typeof STYLE_LABELS, 'balanced'>;
const AXES: Axis[] = ['grappling', 'submission', 'distance', 'power', 'clinch'];

type Rates = {
  takedowns: number;
  control: number;
  ground: number;
  submissions: number;
  distance: number;
  head: number;
  clinch: number;
  knockdowns: number;
  controlShare: number;
  clinchShare: number;
  distanceShare: number;
};

// Per 15 minutes, except the *Share fields (0-1).
const FLOORS: Record<Axis, (r: Rates) => boolean> = {
  grappling: (r) => r.takedowns >= 1.8 || r.controlShare >= 0.25,
  submission: (r) => r.submissions >= 0.8,
  distance: (r) => r.distanceShare >= 0.65,
  power: (r) => r.knockdowns >= 0.45,
  clinch: (r) => r.clinchShare >= 0.19,
};

const EMPTY: StyleSample = {
  seconds: 0, takedownsLanded: 0, controlSeconds: 0, groundLanded: 0, submissionAttempts: 0,
  distanceLanded: 0, headLanded: 0, clinchLanded: 0, knockdowns: 0, sigLanded: 0,
};
const KEYS = Object.keys(EMPTY) as (keyof StyleSample)[];

/** Sums a fighter's fights (oldest first), each earlier fight discounted by `decay` per later fight. */
export function decayedTotals(samples: StyleSample[], decay = DECAY): StyleSample {
  const total = { ...EMPTY };
  for (const sample of samples) {
    for (const key of KEYS) total[key] = total[key] * decay + sample[key];
  }
  return total;
}

function shrunkRates(totals: StyleSample, pool: StyleSample): Rates {
  const rate = (key: keyof StyleSample) => {
    const poolRate = pool.seconds > 0 ? pool[key] / pool.seconds : 0;
    return ((totals[key] + poolRate * PRIOR_SECONDS) / (totals.seconds + PRIOR_SECONDS)) * 900;
  };
  const sig = rate('sigLanded');
  const clinch = rate('clinchLanded');
  const distance = rate('distanceLanded');
  const control = rate('controlSeconds');
  return {
    takedowns: rate('takedownsLanded'),
    control,
    ground: rate('groundLanded'),
    submissions: rate('submissionAttempts'),
    distance,
    head: rate('headLanded'),
    clinch,
    knockdowns: rate('knockdowns'),
    controlShare: control / 900,
    clinchShare: sig > 0 ? clinch / sig : 0,
    distanceShare: sig > 0 ? distance / sig : 0,
  };
}

/** Returns a z-scorer fitted on `values`; a (near-)constant column scores 0. */
function zScorer(values: number[]): (v: number) => number {
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const sd = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
  return sd < 1e-9 ? () => 0 : (v) => (v - mean) / sd;
}

export type StyleCandidate = {
  fighterId: number;
  totals: StyleSample; // decayedTotals() of the fighter's UFC fights
  fights: number;
  isReference: boolean; // part of the pool styles are measured against (e.g. recently active in the division)
};

/**
 * Labels every candidate with enough UFC history (MIN_FIGHTS and MIN_SECONDS);
 * the others get null. Styles are relative to the reference candidates (all
 * eligible candidates if fewer than 10 are flagged), so call it once per
 * division with that division's fighters.
 */
export function classifyStyles(candidates: StyleCandidate[]): Map<number, StyleLabel | null> {
  const result = new Map<number, StyleLabel | null>(candidates.map((c) => [c.fighterId, null]));
  const eligible = candidates.filter((c) => c.fights >= MIN_FIGHTS && c.totals.seconds >= MIN_SECONDS);
  if (eligible.length < 10) return result;
  const flagged = eligible.filter((c) => c.isReference);
  const reference = flagged.length >= 10 ? flagged : eligible;

  const pool = { ...EMPTY };
  for (const c of reference) for (const key of KEYS) pool[key] += c.totals[key];

  const rates = new Map(eligible.map((c) => [c.fighterId, shrunkRates(c.totals, pool)]));
  const refRates = reference.map((c) => rates.get(c.fighterId)!);
  const z = (key: keyof Rates) => zScorer(refRates.map((r) => r[key]));
  const zs = {
    takedowns: z('takedowns'), control: z('control'), ground: z('ground'), submissions: z('submissions'),
    distance: z('distance'), head: z('head'), clinch: z('clinch'), clinchShare: z('clinchShare'), knockdowns: z('knockdowns'),
  };
  const rawAxes = (r: Rates): Record<Axis, number> => ({
    grappling: (zs.takedowns(r.takedowns) + zs.control(r.control) + zs.ground(r.ground)) / 3,
    submission: zs.submissions(r.submissions),
    distance: (zs.distance(r.distance) + zs.head(r.head)) / 2,
    power: zs.knockdowns(r.knockdowns),
    clinch: (zs.clinch(r.clinch) + zs.clinchShare(r.clinchShare)) / 2,
  });
  const refAxes = refRates.map(rawAxes);
  const axisZ = Object.fromEntries(AXES.map((a) => [a, zScorer(refAxes.map((x) => x[a]))])) as Record<Axis, (v: number) => number>;

  for (const c of eligible) {
    const r = rates.get(c.fighterId)!;
    const raw = rawAxes(r);
    const best = AXES.map((a) => ({ a, score: axisZ[a](raw[a]) }))
      .filter(({ a, score }) => score >= AXIS_THRESHOLD && FLOORS[a](r))
      .sort((x, y) => y.score - x.score)[0];
    result.set(c.fighterId, best ? STYLE_LABELS[best.a] : STYLE_LABELS.balanced);
  }
  return result;
}
