// data/scripts/calibrate-ratings.ts
//
// Exploratory calibration tool (Task 6 of docs/superpowers/specs/
// 2026-09-14-fighter-rating-algorithm-design.md's plan) -- runs
// computeDominanceScore + simulateDivisionRatings against the real,
// fully-backfilled Neon dataset and prints distributions/sanity checks, so
// the formula's constants get tuned against real fights rather than
// guessed. Not unit tested (I/O script, same rationale as sync-fighter-stats.ts
// etc.) -- run with `npm run calibrate:ratings`.
//
import fs from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';
import { computeDominanceScore, type FightStatsSide, type RoundStatsSide } from '../lib/rating/dominance-score';
import { normalizeWeightClass } from '../lib/rating/normalize-weight-class';
import { simulateDivisionRatings, type DivisionFightInput } from '../lib/rating/simulate-division';

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
  fighter_name: string;
  opponent_name: string;
  event_name: string;
  event_date: string | null;
  ufcstats_fight_url: string;
  result: string | null;
  weight_class: string | null;
  is_title_fight: boolean | null;
  method: string | null;
  finish_round: number | null;
  scheduled_rounds: number | null;
  sig_strikes_landed: number;
  control_time_seconds: number | null;
};

type RoundRow = {
  fighter_fight_stats_id: number;
  round: number;
  sig_strikes_landed: number;
  control_time_seconds: number | null;
  knockdowns: number;
};

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
  return sorted[idx];
}

function printDistribution(label: string, values: number[]) {
  if (values.length === 0) {
    console.log(`${label}: no data`);
    return;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  console.log(
    `${label}: n=${values.length} min=${sorted[0].toFixed(3)} p10=${percentile(sorted, 0.1).toFixed(3)} ` +
      `p25=${percentile(sorted, 0.25).toFixed(3)} median=${percentile(sorted, 0.5).toFixed(3)} ` +
      `p75=${percentile(sorted, 0.75).toFixed(3)} p90=${percentile(sorted, 0.9).toFixed(3)} ` +
      `max=${sorted[sorted.length - 1].toFixed(3)} avg=${avg.toFixed(3)}`,
  );
}

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

async function main() {
  console.log('Loading fighter_fight_stats + fighter_fight_round_stats + fighters from Neon...');

  const statsRows = (await sql`
    SELECT ffs.id, ffs.fighter_id, f.name AS fighter_name, ffs.opponent_name, ffs.event_name, ffs.event_date,
           ffs.ufcstats_fight_url, ffs.result, ffs.weight_class, ffs.is_title_fight, ffs.method, ffs.finish_round, ffs.scheduled_rounds,
           ffs.sig_strikes_landed, ffs.control_time_seconds
    FROM fighter_fight_stats ffs
    JOIN fighters f ON f.id = ffs.fighter_id
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
  console.log(`Paired ${pairs.length} finished fights (win/loss) out of ${byFightUrl.size} distinct fight URLs.\n`);

  // --- Step 1: dominance score distribution + method breakdown ---
  console.log('=== computeDominanceScore distribution ===');
  const allScores: number[] = [];
  const byMethod: Record<string, number[]> = { ko_tko: [], submission: [], decision: [], other: [] };
  let estimatedCount = 0;

  const dominanceByPair = new Map<Pair, ReturnType<typeof computeDominanceScore>>();
  for (const pair of pairs) {
    const winnerSide = toFightStatsSide(pair.winner, roundsByStatsId.get(pair.winner.id) ?? []);
    const loserSide = toFightStatsSide(pair.loser, roundsByStatsId.get(pair.loser.id) ?? []);
    const result = computeDominanceScore(winnerSide, loserSide);
    dominanceByPair.set(pair, result);
    allScores.push(result.score);
    if (result.estimated) estimatedCount++;
    const m = (pair.winner.method ?? '').toLowerCase();
    if (m.startsWith('ko') || m.startsWith('tko')) byMethod.ko_tko.push(result.score);
    else if (m.startsWith('sub')) byMethod.submission.push(result.score);
    else if (m.startsWith('decision')) byMethod.decision.push(result.score);
    else byMethod.other.push(result.score);
  }

  printDistribution('All fights', allScores);
  printDistribution('KO/TKO', byMethod.ko_tko);
  printDistribution('Submission', byMethod.submission);
  printDistribution('Decision', byMethod.decision);
  console.log(`Estimated (no round-by-round) fallback used: ${estimatedCount}/${pairs.length}\n`);

  // --- Named sanity checks ---
  const khabibDecisions = pairs.filter(
    (p) => p.winner.fighter_name === 'Khabib Nurmagomedov' && (p.winner.method ?? '').toLowerCase().startsWith('decision'),
  );
  console.log(`Khabib Nurmagomedov decision wins (n=${khabibDecisions.length}):`);
  for (const p of khabibDecisions) {
    const r = dominanceByPair.get(p)!;
    console.log(`  vs ${p.loser.fighter_name} (${p.winner.event_name}): score=${r.score.toFixed(3)} estimated=${r.estimated}`);
  }

  const winsByFighter = new Map<string, Pair[]>();
  for (const p of pairs) {
    const list = winsByFighter.get(p.winner.fighter_name) ?? [];
    list.push(p);
    winsByFighter.set(p.winner.fighter_name, list);
  }
  type BestFinisher = { name: string; rate: number; wins: Pair[] };
  let bestFinisher: BestFinisher | null = null;
  for (const [name, wins] of Array.from(winsByFighter.entries())) {
    if (wins.length < 8) continue;
    const finishes = wins.filter((p) => {
      const m = (p.winner.method ?? '').toLowerCase();
      return m.startsWith('ko') || m.startsWith('tko') || m.startsWith('sub');
    });
    const rate = finishes.length / wins.length;
    if (!bestFinisher || rate > bestFinisher.rate) bestFinisher = { name, rate, wins: finishes };
  }
  if (bestFinisher) {
    console.log(`\nHighest finish-rate fighter among fighters with >=8 UFC wins: ${bestFinisher.name} (${(bestFinisher.rate * 100).toFixed(0)}% finish rate)`);
    const finishScores = bestFinisher.wins.map((p) => dominanceByPair.get(p)!.score);
    printDistribution(`  ${bestFinisher.name}'s finishes`, finishScores);
  }
  const khabibAvg = khabibDecisions.length ? khabibDecisions.reduce((s, p) => s + dominanceByPair.get(p)!.score, 0) / khabibDecisions.length : NaN;
  console.log(`\nKhabib decisions avg: ${khabibAvg.toFixed(3)} -- compare against the finisher's average above and the "Decision" distribution's median.\n`);

  // --- Step 2: point-flow simulation per division ---
  console.log('=== Point-flow simulation per division ===');
  const byDivision = new Map<string, Pair[]>();
  for (const pair of pairs) {
    const division = normalizeWeightClass(pair.winner.weight_class ?? '');
    if (!division) continue;
    const list = byDivision.get(division) ?? [];
    list.push(pair);
    byDivision.set(division, list);
  }

  const allDisplayCandidates: number[] = [];
  for (const [division, divisionPairs] of Array.from(byDivision.entries()).sort()) {
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

    const { fighterStates } = simulateDivisionRatings(fights);
    const points = Array.from(fighterStates.values()).map((s) => s.points);
    allDisplayCandidates.push(...points);
    printDistribution(division, points);

    const top5 = Array.from(fighterStates.entries())
      .sort((a, b) => b[1].points - a[1].points)
      .slice(0, 5);
    const idToName = new Map<number, string>();
    for (const p of divisionPairs) {
      idToName.set(p.winner.fighter_id, p.winner.fighter_name);
      idToName.set(p.loser.fighter_id, p.loser.fighter_name);
    }
    console.log(`  Top 5: ${top5.map(([id, s]) => `${idToName.get(id) ?? id} (${s.points.toFixed(4)})`).join(', ')}`);
  }

  console.log('\n=== Suggested display-rescale floor/ceiling (across all divisions combined) ===');
  const sortedAll = allDisplayCandidates.slice().sort((a, b) => a - b);
  console.log(`p05=${percentile(sortedAll, 0.05).toFixed(4)} p50=${percentile(sortedAll, 0.5).toFixed(4)} p95=${percentile(sortedAll, 0.95).toFixed(4)} p99=${percentile(sortedAll, 0.99).toFixed(4)} max=${sortedAll[sortedAll.length - 1].toFixed(4)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
