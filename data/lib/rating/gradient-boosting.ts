// data/lib/rating/gradient-boosting.ts
//
// A small gradient-boosted tree classifier (log-loss, second-order leaves,
// histogram splits), only as a yardstick for the simulator's linear matchup
// layer: `npm run bench:gbm` (data/scripts/bench-gbm.ts) asks how much a
// non-linear model would gain on the same data. Never shipped to the site.
// Pure functions. Missing values (NaN) get their own bin, below every value.

export type GbmParams = {
  trees: number; // maximum; early stopping on a validation set may keep fewer
  learningRate: number;
  maxDepth: number;
  minLeafHessian: number; // sum of p(1-p) a leaf must hold (about "samples" near p = 0.5, x4)
  lambda: number; // L2 on leaf values
  subsample: number; // share of rows each tree sees
  bins: number; // quantile bins per feature
  seed: number;
};

export const DEFAULT_GBM_PARAMS: GbmParams = { trees: 800, learningRate: 0.05, maxDepth: 3, minLeafHessian: 5, lambda: 1, subsample: 0.8, bins: 32, seed: 1 };

type Node = { feature: number; bin: number; left: number; right: number } | { value: number };
export type GbmModel = { edges: number[][]; trees: Node[][]; learningRate: number };

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Quantile cut points per feature, from the training rows. */
function quantileEdges(x: number[][], bins: number): number[][] {
  return x[0].map((_, f) => {
    const values = x.map((row) => row[f]).filter((v) => !Number.isNaN(v)).sort((a, b) => a - b);
    const edges: number[] = [];
    for (let i = 1; i < bins; i++) {
      const v = values[Math.floor((i / bins) * values.length)];
      if (v !== undefined && (edges.length === 0 || v > edges[edges.length - 1])) edges.push(v);
    }
    return edges;
  });
}

/** Bin 0 is NaN; value v goes to 1 + the number of edges <= v. */
function binOf(v: number, edges: number[]): number {
  if (Number.isNaN(v)) return 0;
  let lo = 0;
  let hi = edges.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (edges[mid] <= v) lo = mid + 1;
    else hi = mid;
  }
  return lo + 1;
}

const binRow = (row: number[], edges: number[][]) => row.map((v, f) => binOf(v, edges[f]));

function treeScore(tree: Node[], bins: number[]): number {
  let node = tree[0];
  while (!('value' in node)) node = tree[bins[node.feature] <= node.bin ? node.left : node.right];
  return node.value;
}

function buildTree(rows: number[], binned: number[][], g: number[], h: number[], edges: number[][], params: GbmParams): Node[] {
  const nodes: Node[] = [];
  const leafValue = (G: number, H: number) => -G / (H + params.lambda);
  const grow = (idx: number[], depth: number): number => {
    const at = nodes.length;
    nodes.push({ value: 0 });
    let G = 0;
    let H = 0;
    for (const i of idx) {
      G += g[i];
      H += h[i];
    }
    let best: { gain: number; feature: number; bin: number } | null = null;
    if (depth < params.maxDepth && H >= 2 * params.minLeafHessian) {
      const parent = (G * G) / (H + params.lambda);
      for (let f = 0; f < edges.length; f++) {
        const size = edges[f].length + 2;
        const gs = new Float64Array(size);
        const hs = new Float64Array(size);
        for (const i of idx) {
          gs[binned[i][f]] += g[i];
          hs[binned[i][f]] += h[i];
        }
        let gl = 0;
        let hl = 0;
        for (let b = 0; b < size - 1; b++) {
          gl += gs[b];
          hl += hs[b];
          const hr = H - hl;
          if (hl < params.minLeafHessian || hr < params.minLeafHessian) continue;
          const gr = G - gl;
          const gain = (gl * gl) / (hl + params.lambda) + (gr * gr) / (hr + params.lambda) - parent;
          if (gain > 1e-9 && (!best || gain > best.gain)) best = { gain, feature: f, bin: b };
        }
      }
    }
    if (!best) {
      nodes[at] = { value: leafValue(G, H) };
      return at;
    }
    const { feature, bin } = best;
    const left = grow(
      idx.filter((i) => binned[i][feature] <= bin),
      depth + 1,
    );
    const right = grow(
      idx.filter((i) => binned[i][feature] > bin),
      depth + 1,
    );
    nodes[at] = { feature, bin, left, right };
    return at;
  };
  grow(rows, 0);
  return nodes;
}

const logLossOf = (p: number, y: number) => -Math.log(Math.max(y ? p : 1 - p, 1e-12));

/**
 * Fits on (x, y). With `valid`, also returns the validation log-loss after
 * each tree and keeps only the trees up to its minimum (early stopping).
 * Starts from 0 (p = 0.5): the callers train on both corners of every fight.
 */
export function fitGbm(
  x: number[][],
  y: number[],
  params: GbmParams = DEFAULT_GBM_PARAMS,
  valid?: { x: number[][]; y: number[] },
): { model: GbmModel; validLoss: number[] } {
  const edges = quantileEdges(x, params.bins);
  const binned = x.map((row) => binRow(row, edges));
  const validBinned = valid?.x.map((row) => binRow(row, edges)) ?? [];
  const f = new Float64Array(x.length);
  const fv = new Float64Array(validBinned.length);
  const random = mulberry32(params.seed);
  const trees: Node[][] = [];
  const validLoss: number[] = [];
  const g = new Array<number>(x.length);
  const h = new Array<number>(x.length);
  let bestLoss = Infinity;
  let bestCount = 0;

  for (let t = 0; t < params.trees; t++) {
    for (let i = 0; i < x.length; i++) {
      const p = sigmoid(f[i]);
      g[i] = p - y[i];
      h[i] = p * (1 - p);
    }
    const rows: number[] = [];
    for (let i = 0; i < x.length; i++) if (random() < params.subsample) rows.push(i);
    const tree = buildTree(rows, binned, g, h, edges, params);
    for (const node of tree) if ('value' in node) node.value *= params.learningRate;
    trees.push(tree);
    for (let i = 0; i < x.length; i++) f[i] += treeScore(tree, binned[i]);
    if (valid) {
      let loss = 0;
      for (let i = 0; i < validBinned.length; i++) {
        fv[i] += treeScore(tree, validBinned[i]);
        loss += logLossOf(sigmoid(fv[i]), valid.y[i]);
      }
      validLoss.push(loss / validBinned.length);
      if (validLoss[t] < bestLoss) {
        bestLoss = validLoss[t];
        bestCount = t + 1;
      }
      if (t + 1 - bestCount >= 100) break; // no gain in 100 trees
    }
  }
  return { model: { edges, trees: valid ? trees.slice(0, bestCount) : trees, learningRate: params.learningRate }, validLoss };
}

export function predictGbm(model: GbmModel, row: number[]): number {
  const bins = binRow(row, model.edges);
  return sigmoid(model.trees.reduce((z, tree) => z + treeScore(tree, bins), 0));
}
