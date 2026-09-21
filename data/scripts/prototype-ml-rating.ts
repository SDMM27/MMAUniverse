// data/scripts/prototype-ml-rating.ts
//
// FightScore v2 exploration -- see docs/superpowers/specs/
// 2026-09-14-fighter-rating-algorithm-design.md, "Roadmap v2": before
// investing in a spec/plan for a trained model, empirically check whether
// one actually adds predictive lift on top of the point-flow engine's own
// points differential. Not wired into any batch job, doesn't write to the
// DB -- read-only exploration. Run with `npm run explore:ml-rating`.
//
// Approach: walk every UFC division chronologically (same pairing/grouping
// as compute-fighter-ratings.ts), and for each fight, snapshot each
// fighter's state strictly BEFORE that fight -- point-flow points (via
// simulateDivisionRatings, already point-in-time-correct), streak,
// former-champion flag, and per-15-min style-stat rates accumulated only
// from that fighter's earlier fights in this division. Build one training
// example per fight with a fixed 50/50 fighterA/fighterB split (feature =
// A - B, label = 1 if A won) so the model can't cheat by learning "the
// example is always constructed from the winner's side". Then a
// chronological train/test split (earliest 80% / most recent 20%) so
// evaluation reflects "would this have worked on real future fights", not a
// random split that mixes past and future.
//
// Compares three predictors on the held-out test set:
//   1. naive: sign(pointsDiff) -- does the existing point-flow score alone
//      already pick the winner, no model at all?
//   2. points-only logistic regression -- same single feature, but lets a
//      trained model find a probability curve/threshold instead of a raw sign.
//   3. full logistic regression -- points + streak + former-champion + all
//      style-stat-rate differentials.
// If (3) doesn't clearly beat (1)/(2), the style features aren't adding
// real signal yet and a production trained model isn't worth building on
// top of this feature set as-is.
import fs from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';
import { normalizeWeightClass } from '../lib/rating/normalize-weight-class';
import { simulateDivisionRatings, type DivisionFightInput } from '../lib/rating/simulate-division';
import type { FightStatsSide, RoundStatsSide } from '../lib/rating/dominance-score';
import {
  WIN_PREDICTOR_FEATURE_NAMES as FEATURE_NAMES,
  buildMatchupFeatures,
  replayDivision,
  styleSampleFromRow,
  type ReplayFight,
} from '../lib/rating/win-predictor-features';
import { trainLogisticRegression, predictProbability, logLoss } from '../lib/rating/logistic-regression';

function loadEnvLocal() {
  const envPath = path.resolve('.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvLocal();
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set (expected in .env.local)');
  process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);

type StatsRow = {
  id: number;
  fighter_id: number;
  event_date: string | null;
  ufcstats_fight_url: string;
  result: string | null;
  weight_class: string | null;
  is_title_fight: boolean | null;
  method: string | null;
  finish_round: number | null;
  finish_time: string | null;
  scheduled_rounds: number | null;
  sig_strikes_landed: number;
  control_time_seconds: number | null;
  sig_strikes_head_attempted: number;
  sig_strikes_body_attempted: number;
  sig_strikes_leg_attempted: number;
  sig_strikes_distance_attempted: number;
  sig_strikes_clinch_attempted: number;
  sig_strikes_ground_attempted: number;
  takedowns_landed: number;
  takedowns_attempted: number;
  submission_attempts: number;
};

type RoundRow = { fighter_fight_stats_id: number; round: number; sig_strikes_landed: number; control_time_seconds: number | null; knockdowns: number };

function toRoundSide(rows: RoundRow[]): RoundStatsSide[] {
  return rows
    .slice()
    .sort((a, b) => a.round - b.round)
    .map((r) => ({ round: r.round, sigStrikesLanded: r.sig_strikes_landed, controlTimeSeconds: r.control_time_seconds, knockdowns: r.knockdowns }));
}

function toFightStatsSide(row: StatsRow, rounds: RoundRow[]): FightStatsSide {
  return {
    method: row.method ?? '',
    finishRound: row.finish_round,
    sigStrikesLandedTotal: row.sig_strikes_landed,
    controlTimeSecondsTotal: row.control_time_seconds,
    rounds: toRoundSide(rounds),
  };
}

// mulberry32 -- deterministic so the A/B example-construction coin flip is
// reproducible across runs (same rationale as style-clustering.ts's seed).
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Example = { eventDate: string; features: number[]; label: number };

async function main() {
  console.log('Loading fighter_fight_stats + fighter_fight_round_stats from Neon...');
  const statsRows = (await sql`
    SELECT ffs.id, ffs.fighter_id, ffs.event_date, ffs.ufcstats_fight_url, ffs.result, ffs.weight_class,
           ffs.is_title_fight, ffs.method, ffs.finish_round, ffs.finish_time, ffs.scheduled_rounds,
           ffs.sig_strikes_landed, ffs.control_time_seconds,
           ffs.sig_strikes_head_attempted, ffs.sig_strikes_body_attempted, ffs.sig_strikes_leg_attempted,
           ffs.sig_strikes_distance_attempted, ffs.sig_strikes_clinch_attempted, ffs.sig_strikes_ground_attempted,
           ffs.takedowns_landed, ffs.takedowns_attempted, ffs.submission_attempts
    FROM fighter_fight_stats ffs
  `) as StatsRow[];

  const roundRows = (await sql`
    SELECT fighter_fight_stats_id, round, sig_strikes_landed, control_time_seconds, knockdowns
    FROM fighter_fight_round_stats
  `) as RoundRow[];
  const roundsByStatsId = new Map<number, RoundRow[]>();
  for (const r of roundRows) {
    const list = roundsByStatsId.get(r.fighter_fight_stats_id) ?? [];
    list.push(r);
    roundsByStatsId.set(r.fighter_fight_stats_id, list);
  }

  const byFightUrl = new Map<string, StatsRow[]>();
  for (const row of statsRows) {
    const list = byFightUrl.get(row.ufcstats_fight_url) ?? [];
    list.push(row);
    byFightUrl.set(row.ufcstats_fight_url, list);
  }

  type Pair = { winner: StatsRow; loser: StatsRow };
  const pairs: Pair[] = [];
  Array.from(byFightUrl.values()).forEach((rows) => {
    if (rows.length !== 2) return;
    const winner = rows.find((r) => r.result === 'win');
    const loser = rows.find((r) => r.result === 'loss');
    if (!winner || !loser) return;
    pairs.push({ winner, loser });
  });

  const byDivision = new Map<string, Pair[]>();
  for (const pair of pairs) {
    const division = normalizeWeightClass(pair.winner.weight_class ?? '');
    if (!division) continue;
    const list = byDivision.get(division) ?? [];
    list.push(pair);
    byDivision.set(division, list);
  }

  const rand = mulberry32(7);
  const examples: Example[] = [];

  for (const [, divisionPairs] of Array.from(byDivision.entries())) {
    const sorted = divisionPairs
      .filter((p) => p.winner.event_date)
      .sort((a, b) => (a.winner.event_date! < b.winner.event_date! ? -1 : 1));

    const fights: DivisionFightInput[] = sorted.map((p) => ({
      fightUrl: p.winner.ufcstats_fight_url,
      eventDate: p.winner.event_date!,
      isTitleFight: p.winner.is_title_fight ?? false,
      isFiveRounds: p.winner.scheduled_rounds === 5,
      winnerId: p.winner.fighter_id,
      loserId: p.loser.fighter_id,
      winnerSide: toFightStatsSide(p.winner, roundsByStatsId.get(p.winner.id) ?? []),
      loserSide: toFightStatsSide(p.loser, roundsByStatsId.get(p.loser.id) ?? []),
    }));

    const { history } = simulateDivisionRatings(fights);

    const replayFights: ReplayFight[] = sorted.map((p, i) => ({
      eventDate: p.winner.event_date!,
      isTitleFight: p.winner.is_title_fight ?? false,
      winnerId: p.winner.fighter_id,
      loserId: p.loser.fighter_id,
      winnerSample: styleSampleFromRow(p.winner),
      loserSample: styleSampleFromRow(p.loser),
      dominanceScore: history[i].dominanceScore,
      winnerPointsAfter: history[i].winnerPointsAfter,
      loserPointsAfter: history[i].loserPointsAfter,
    }));

    // Snapshot each fighter's state strictly BEFORE the fight, then it is applied.
    replayDivision(replayFights, (fight, _i, winnerState, loserState) => {
      const winnerFeatures = buildMatchupFeatures(winnerState, loserState, fight.eventDate);

      // 50/50 coin flip on which side is "A" so the label isn't always 1.
      const winnerIsA = rand() < 0.5;
      examples.push({
        eventDate: fight.eventDate,
        features: winnerIsA ? winnerFeatures : winnerFeatures.map((v) => -v),
        label: winnerIsA ? 1 : 0,
      });
    });
  }

  examples.sort((a, b) => (a.eventDate < b.eventDate ? -1 : 1));
  console.log(`Built ${examples.length} training examples across ${byDivision.size} divisions.`);

  const splitIndex = Math.floor(examples.length * 0.8);
  const train = examples.slice(0, splitIndex);
  const test = examples.slice(splitIndex);
  console.log(`Chronological split: ${train.length} train (up to ${train[train.length - 1].eventDate}), ${test.length} test (from ${test[0].eventDate}).`);

  // 1. Naive baseline: sign(pointsDiff), no training at all.
  let naiveCorrect = 0;
  for (const ex of test) {
    const predictedA = ex.features[0] > 0 ? 1 : 0;
    if (predictedA === ex.label) naiveCorrect++;
  }
  console.log(`\n1. Naive sign(pointsDiff): accuracy ${(naiveCorrect / test.length * 100).toFixed(1)}%`);

  // 2. Points-only logistic regression.
  const pointsOnlyModel = trainLogisticRegression(train.map((e) => [e.features[0]]), train.map((e) => e.label));
  const pointsOnlyPreds = test.map((e) => predictProbability(pointsOnlyModel, [e.features[0]]));
  const pointsOnlyAccuracy = pointsOnlyPreds.filter((p, i) => (p >= 0.5 ? 1 : 0) === test[i].label).length / test.length;
  console.log(`2. Points-only logistic regression: accuracy ${(pointsOnlyAccuracy * 100).toFixed(1)}%, log-loss ${logLoss(pointsOnlyPreds, test.map((e) => e.label)).toFixed(4)}`);

  // 3. Full model: points + streak + former-champion + style-stat rates.
  const fullModel = trainLogisticRegression(train.map((e) => e.features), train.map((e) => e.label));
  const fullPreds = test.map((e) => predictProbability(fullModel, e.features));
  const fullAccuracy = fullPreds.filter((p, i) => (p >= 0.5 ? 1 : 0) === test[i].label).length / test.length;
  console.log(`3. Full logistic regression (${FEATURE_NAMES.length} features): accuracy ${(fullAccuracy * 100).toFixed(1)}%, log-loss ${logLoss(fullPreds, test.map((e) => e.label)).toFixed(4)}`);

  console.log(`\nCoin-flip reference log-loss: ${Math.log(2).toFixed(4)}\n`);

  console.log('Full model coefficients (standardized -- magnitude = relative importance):');
  const ranked = FEATURE_NAMES.map((name, i) => ({ name, weight: fullModel.weights[i] })).sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
  for (const { name, weight } of ranked) {
    console.log(`  ${name.padEnd(28)} ${weight >= 0 ? '+' : ''}${weight.toFixed(3)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
