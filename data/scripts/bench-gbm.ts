// data/scripts/bench-gbm.ts
//
// `npm run bench:gbm`: how much is left on the table by the simulator's
// linear matchup layer? Trains a gradient-boosted tree model
// (data/lib/rating/gradient-boosting.ts) on the same fights, windows and
// pre-fight information as tune-matchup, and compares log-loss:
//   - "same inputs": the layer's eight terms, so only non-linearity can help,
//   - "raw": each corner's values separately (rating, RD, age, reach, layoff,
//     cage time, career rates), so it can find interactions on its own.
// Hyperparameters and the tree count are picked on the most recent 20% of
// each window's training fights, never on the window itself. Every fight is
// learned from both corners and predicted as the average of both, so
// P(A) + P(B) = 1 as in the simulator. If boosting doesn't beat the linear
// layer by ~0.005, what's left to gain is in the data, not the model.
// Writes nothing; read-only against Neon.
import { simulateCareerRatings } from '../lib/rating/simulate-career';
import { MATCHUP_TERMS, matchupFeatures, profileRates, MATCHUP_SHAPE, type MatchupProfile } from '../lib/rating/matchup-model';
import { MATCHUP_MODEL } from '../lib/rating/matchup-model-tuned';
import { DEFAULT_GBM_PARAMS, fitGbm, predictGbm, type GbmParams } from '../lib/rating/gradient-boosting';
import type { GlickoRating } from '../lib/rating/glicko-rating';
import { WINDOWS, attachRatings, fit, loadMatchupData, metrics, shape, withModel, type Metrics, type Sample } from './matchup-tuning';

const GRID: Partial<GbmParams>[] = [2, 3, 4].flatMap((maxDepth) => [5, 20].map((minLeafHessian) => ({ maxDepth, minLeafHessian })));
const VALID_SHARE = 0.2;

type Featurizer = { name: string; names: string[]; row: (s: Sample, flip: boolean) => number[] };

const veteranAge = MATCHUP_MODEL.veteranAge;
const logit = (p: number) => Math.log(p / (1 - p));
const orNaN = (v: number | null) => (v == null ? NaN : v);

const SAME_INPUTS: Featurizer = {
  name: 'same inputs',
  names: [...MATCHUP_TERMS],
  row: (s, flip) => {
    const x = flip ? matchupFeatures(1 - s.ratingWinA, s.b, s.a, shape(veteranAge)) : matchupFeatures(s.ratingWinA, s.a, s.b, shape(veteranAge));
    return MATCHUP_TERMS.map((t) => x[t]);
  },
};

const corner = (r: GlickoRating, p: MatchupProfile) => {
  const rates = profileRates(p, MATCHUP_SHAPE.priorMinutes);
  return [r.rating, r.rd, orNaN(p.age), orNaN(p.reachCm), orNaN(p.monthsSinceLastFight), p.ufcMinutes, rates.strikeDiffPerMin, rates.controlShare, rates.knockdownsAbsorbedPer15];
};
const CORNER_NAMES = ['rating', 'rd', 'age', 'reach', 'monthsSinceLastFight', 'ufcMinutes', 'strikeDiffPerMin', 'controlShare', 'knockdownsAbsorbedPer15'];

const RAW: Featurizer = {
  name: 'raw',
  names: ['ratingLogit', ...CORNER_NAMES.map((n) => `A.${n}`), ...CORNER_NAMES.map((n) => `B.${n}`)],
  row: (s, flip) => {
    const a = corner(s.ratingA, s.a);
    const b = corner(s.ratingB, s.b);
    const l = logit(Math.min(Math.max(s.ratingWinA, 1e-9), 1 - 1e-9));
    return flip ? [-l, ...b, ...a] : [l, ...a, ...b];
  },
};

// Both corners of every fight.
const augment = (samples: Sample[], f: Featurizer) => ({
  x: samples.flatMap((s) => [f.row(s, false), f.row(s, true)]),
  y: samples.flatMap((s) => [s.aWon ? 1 : 0, s.aWon ? 0 : 1]),
});

function trainGbm(train: Sample[], f: Featurizer) {
  const sorted = [...train].sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
  const cut = Math.floor(sorted.length * (1 - VALID_SHARE));
  const inner = augment(sorted.slice(0, cut), f);
  const valid = augment(sorted.slice(cut), f);
  let best: { params: GbmParams; loss: number; trees: number } | null = null;
  for (const config of GRID) {
    const params = { ...DEFAULT_GBM_PARAMS, ...config };
    const { validLoss } = fitGbm(inner.x, inner.y, params, valid);
    const loss = Math.min(...validLoss);
    if (!best || loss < best.loss) best = { params, loss, trees: validLoss.indexOf(loss) + 1 };
  }
  // Refit on every training fight; a bit more data, so a few more trees.
  const all = augment(train, f);
  const { model } = fitGbm(all.x, all.y, { ...best!.params, trees: Math.ceil(best!.trees / (1 - VALID_SHARE)) });
  const predict = (s: Sample) => (predictGbm(model, f.row(s, false)) + 1 - predictGbm(model, f.row(s, true))) / 2;
  return { model, predict, params: best!.params, trees: model.trees.length };
}

const fmt = (m: Metrics) => `${m.logLoss.toFixed(4)} (${(m.accuracy * 100).toFixed(1)}%)`;

async function main() {
  const { fights, noResults, contexts } = await loadMatchupData();
  const samples = attachRatings(contexts, simulateCareerRatings(fights, noResults).history);
  console.log(`${samples.length} decided UFC fights. Log-loss (accuracy), trained before each window and tested inside it.\n`);
  console.log(`  ${'window'.padEnd(32)} ${'linear layer'.padEnd(17)} ${'GBM same inputs'.padEnd(17)} GBM raw`);

  const gaps: { same: number; raw: number; count: number }[] = [];
  let lastRaw: ReturnType<typeof trainGbm> | null = null;
  for (const [from, to] of WINDOWS) {
    const train = samples.filter((s) => s.date < from);
    const inside = samples.filter((s) => s.date >= from && s.date < to);
    const linear = metrics(inside, withModel(fit(train, veteranAge)));
    const same = trainGbm(train, SAME_INPUTS);
    const raw = trainGbm(train, RAW);
    const sameM = metrics(inside, same.predict);
    const rawM = metrics(inside, raw.predict);
    lastRaw = raw;
    gaps.push({ same: linear.logLoss - sameM.logLoss, raw: linear.logLoss - rawM.logLoss, count: inside.length });
    const label = `${from} -> ${to.slice(0, 4) === '9999' ? 'today' : to} (${inside.length})`;
    console.log(`  ${label.padEnd(32)} ${fmt(linear).padEnd(17)} ${fmt(sameM).padEnd(17)} ${fmt(rawM)}`);
    console.log(`  ${''.padEnd(32)} ${''.padEnd(17)} ${`depth ${same.params.maxDepth}, ${same.trees} trees`.padEnd(17)} depth ${raw.params.maxDepth}, ${raw.trees} trees`);
  }

  const total = gaps.reduce((n, g) => n + g.count, 0);
  const mean = (key: 'same' | 'raw') => gaps.reduce((sum, g) => sum + g[key] * g.count, 0) / total;
  console.log(`\nGBM gain over the linear layer (positive = GBM better), fight-weighted over the 4 windows:`);
  console.log(`  same inputs  ${mean('same') >= 0 ? '+' : ''}${mean('same').toFixed(4)}   per window: ${gaps.map((g) => g.same.toFixed(4)).join(', ')}`);
  console.log(`  raw          ${mean('raw') >= 0 ? '+' : ''}${mean('raw').toFixed(4)}   per window: ${gaps.map((g) => g.raw.toFixed(4)).join(', ')}`);
  const verdict = Math.max(mean('same'), mean('raw')) >= 0.005 ? 'the model shape matters: worth looking at what the trees found' : 'under 0.005: what is left to gain is in the data, not the model';
  console.log(`  -> ${verdict}`);

  // Where the raw model splits most often, on the latest window's training fights.
  const counts = new Map<string, number>();
  for (const tree of lastRaw!.model.trees) for (const node of tree) if (!('value' in node)) counts.set(RAW.names[node.feature], (counts.get(RAW.names[node.feature]) ?? 0) + 1);
  const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
  console.log(`\nMost used inputs of the raw model (splits, latest window): ${top.map(([n, c]) => `${n} ${c}`).join(', ')}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
