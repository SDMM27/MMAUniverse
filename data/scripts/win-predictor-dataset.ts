// data/scripts/win-predictor-dataset.ts
//
// Shared by the ML prototype and the training script: loads UFC fight stats
// from Neon and builds the chronologically-sorted training examples (one per
// fight, fixed 50/50 A/B split so the label isn't always 1, feature = A - B).
// Every example is a point-in-time snapshot taken strictly before its fight.
// I/O, not unit tested -- the pure feature logic lives in
// data/lib/rating/win-predictor-features.ts.
import type { NeonQueryFunction } from '@neondatabase/serverless';
import { normalizeWeightClass } from '../lib/rating/normalize-weight-class';
import { simulateDivisionRatings, type DivisionFightInput } from '../lib/rating/simulate-division';
import type { FightStatsSide, RoundStatsSide } from '../lib/rating/dominance-score';
import { buildMatchupFeatures, replayDivision, styleSampleFromRow, type ReplayFight } from '../lib/rating/win-predictor-features';

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

export type Example = { eventDate: string; features: number[]; label: number };

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

/** Loads every UFC fight from Neon and returns the training examples sorted oldest-first, plus the division count. */
export async function loadWinPredictorExamples(sql: NeonQueryFunction<false, false>): Promise<{ examples: Example[]; divisionCount: number }> {
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
  return { examples, divisionCount: byDivision.size };
}
