// data/lib/rating/style-clustering.ts
//
// Style-archetype clustering for FightScore -- see docs/superpowers/specs/
// 2026-09-14-fighter-rating-algorithm-design.md, "Profils de style (« styles
// de combattant ») — clustering ML". This is the genuine unsupervised-ML
// component of the system (the point-flow engine itself is an explicit
// statistical formula, not a trained model). Hand-rolled k-means -- the
// dataset per division is small (a few hundred fighters at most), no ML
// dependency needed.

export type StyleFeatures = {
  sigStrikesHeadRate: number; // per 15 min of cage time, all rates below share that unit
  sigStrikesBodyRate: number;
  sigStrikesLegRate: number;
  sigStrikesDistanceRate: number;
  sigStrikesClinchRate: number;
  sigStrikesGroundRate: number;
  takedownRate: number;
  takedownAccuracy: number; // 0-1, not a per-15-min rate
  controlTimeRate: number; // control-time seconds per 15 min
  submissionAttemptRate: number;
};

const FEATURE_KEYS: (keyof StyleFeatures)[] = [
  'sigStrikesHeadRate',
  'sigStrikesBodyRate',
  'sigStrikesLegRate',
  'sigStrikesDistanceRate',
  'sigStrikesClinchRate',
  'sigStrikesGroundRate',
  'takedownRate',
  'takedownAccuracy',
  'controlTimeRate',
  'submissionAttemptRate',
];

/**
 * Converts a set of fighters' style features into z-score-normalized vectors
 * (mean 0, unit variance per column across the input set) in FEATURE_KEYS
 * order, so no single feature's raw scale (e.g. control-time seconds vs a
 * 0-1 accuracy ratio) dominates the distance metric k-means uses. A column
 * with zero variance (every fighter identical on that feature) normalizes to
 * a flat 0 rather than dividing by zero.
 */
export function normalizeFeatures(features: StyleFeatures[]): number[][] {
  const raw = features.map((f) => FEATURE_KEYS.map((key) => f[key]));
  if (raw.length === 0) return [];

  const dims = FEATURE_KEYS.length;
  const means = new Array(dims).fill(0);
  for (const row of raw) {
    row.forEach((v, d) => {
      means[d] += v;
    });
  }
  for (let d = 0; d < dims; d++) means[d] /= raw.length;

  const variances = new Array(dims).fill(0);
  for (const row of raw) {
    row.forEach((v, d) => {
      variances[d] += (v - means[d]) ** 2;
    });
  }
  const stddevs = variances.map((v) => Math.sqrt(v / raw.length));

  // A near-zero stddev (every fighter ~identical on that feature) is treated
  // as exactly zero -- floating-point accumulation over the mean/variance
  // sums (e.g. summing 0.4 three times doesn't land back on exactly 0.4)
  // can leave a truly-constant column with a tiny nonzero stddev, which
  // would otherwise blow up into a huge or misleadingly-nonzero z-score.
  const ZERO_VARIANCE_EPSILON = 1e-9;

  return raw.map((row) => row.map((v, d) => (stddevs[d] < ZERO_VARIANCE_EPSILON ? 0 : (v - means[d]) / stddevs[d])));
}

// Deterministic PRNG (mulberry32) so a given seed always produces the same
// k-means++ initialization -- real Math.random() would make cluster
// assignments non-reproducible between runs of the batch script.
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function squaredDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return sum;
}

/** k-means++ initialization: picks the first centroid uniformly, then each next one with probability proportional to its squared distance from the nearest already-chosen centroid -- spreads the starting centroids out instead of risking several landing in the same cluster. */
function kMeansPlusPlusInit(points: number[][], k: number, rand: () => number): number[][] {
  const centroids: number[][] = [points[Math.floor(rand() * points.length)].slice()];

  while (centroids.length < k) {
    const distances = points.map((p) => Math.min(...centroids.map((c) => squaredDistance(p, c))));
    const total = distances.reduce((sum, d) => sum + d, 0);
    if (total === 0) {
      centroids.push(points[Math.floor(rand() * points.length)].slice());
      continue;
    }
    let threshold = rand() * total;
    let chosenIndex = points.length - 1;
    for (let i = 0; i < distances.length; i++) {
      threshold -= distances[i];
      if (threshold <= 0) {
        chosenIndex = i;
        break;
      }
    }
    centroids.push(points[chosenIndex].slice());
  }
  return centroids;
}

function nearestCentroidIndex(point: number[], centroids: number[][]): number {
  let bestIndex = 0;
  let bestDistance = Infinity;
  for (let c = 0; c < centroids.length; c++) {
    const distance = squaredDistance(point, centroids[c]);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = c;
    }
  }
  return bestIndex;
}

function recomputeCentroids(points: number[][], assignments: number[], previous: number[][]): number[][] {
  const dims = points[0].length;
  const sums = previous.map(() => new Array(dims).fill(0));
  const counts = new Array(previous.length).fill(0);
  points.forEach((point, i) => {
    const cluster = assignments[i];
    counts[cluster]++;
    point.forEach((v, d) => {
      sums[cluster][d] += v;
    });
  });
  // A cluster that lost every point (rare, only with a pathological seed/
  // input) keeps its previous centroid rather than becoming NaN.
  return previous.map((old, c) => (counts[c] === 0 ? old : sums[c].map((s) => s / counts[c])));
}

const MAX_ITERATIONS = 100;

/**
 * Standard Lloyd's algorithm with k-means++ initialization and a fixed
 * iteration cap, early-exiting as soon as no point's assignment changes.
 * `seed` defaults to a fixed value so repeated runs (e.g. the batch script
 * re-clustering a division after new fights) are reproducible.
 */
export function kMeans(points: number[][], k: number, seed = 42): { assignments: number[]; centroids: number[][] } {
  if (points.length === 0 || k <= 0) return { assignments: [], centroids: [] };

  const effectiveK = Math.min(k, points.length);
  const rand = mulberry32(seed);
  let centroids = kMeansPlusPlusInit(points, effectiveK, rand);
  let assignments: number[] = new Array(points.length).fill(-1);

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const newAssignments = points.map((p) => nearestCentroidIndex(p, centroids));
    const unchanged = newAssignments.every((a, i) => a === assignments[i]);
    assignments = newAssignments;
    if (unchanged) break;
    centroids = recomputeCentroids(points, assignments, centroids);
  }

  return { assignments, centroids };
}

/**
 * Assigns a human-readable archetype label to a cluster from its centroid
 * (a z-scored vector in FEATURE_KEYS order, as returned by kMeans on
 * normalizeFeatures' output) by comparing 4 broad style axes and picking the
 * most dominant one. **Provisional** -- the exact label set and thresholds
 * are meant to be revisited once real centroids from the batch script
 * (compute-fighter-ratings.ts) are visible; this covers the clearly-
 * separated cases so far (a grappling-dominant centroid vs. a
 * striking-dominant one), not a finished taxonomy.
 */
export function labelCluster(centroid: number[]): string {
  const at = (key: keyof StyleFeatures) => centroid[FEATURE_KEYS.indexOf(key)];

  const grapplingScore = (at('sigStrikesGroundRate') + at('controlTimeRate') + at('takedownRate')) / 3;
  const strikingScore = (at('sigStrikesDistanceRate') + at('sigStrikesHeadRate')) / 2;
  const clinchScore = at('sigStrikesClinchRate');
  const submissionScore = at('submissionAttemptRate');

  const axes: [string, number][] = [
    ['Wrestler / Contrôleur', grapplingScore],
    ['Frappeur de distance', strikingScore],
    ['Pressure fighter (clinch)', clinchScore],
    ['Finisseur soumission', submissionScore],
  ];
  axes.sort((a, b) => b[1] - a[1]);
  return axes[0][0];
}
