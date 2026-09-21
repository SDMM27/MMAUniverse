// data/scripts/compute-fighter-ratings.ts
//
// Batch computation for FightScore -- see docs/superpowers/specs/
// 2026-09-14-fighter-rating-algorithm-design.md. Reads every UFC fighter's
// fighter_fight_stats + fighter_fight_round_stats from Neon, groups fights
// into divisions (normalizeWeightClass), runs simulateDivisionRatings
// chronologically per division, clusters each division's fighters into
// style archetypes (k-means), and upserts fighter_ratings +
// fighter_rating_history. I/O orchestration, not unit tested -- same
// rationale as sync-fighter-stats.ts etc. Run with `npm run compute:ratings`.
//
// KNOWN LIMITATION as of 2026-09-14: `rankings` (the official UFC rankings
// table) currently has zero rank=0 rows for any real division -- a separate,
// already-flagged bug in sync-ufc-rankings.ts (see the "Fix
// sync-ufc-rankings duplicate-rank crash" task) has left it half-populated.
// `is_champion` will come out false for every fighter until that's fixed
// and re-synced -- re-running this script afterward (idempotent) picks up
// champions correctly with no other changes needed.
import fs from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';
import { computeDominanceScore, type FightStatsSide, type RoundStatsSide } from '../lib/rating/dominance-score';
import { normalizeWeightClass } from '../lib/rating/normalize-weight-class';
import { simulateDivisionRatings, pointsAsOf, type DivisionFightInput, type DivisionNoResultInput } from '../lib/rating/simulate-division';
import { isRankingEligible } from '../lib/rating/ranking-eligibility';
import { normalizeFeatures, kMeans, labelCluster, type StyleFeatures } from '../lib/rating/style-clustering';
import { predictProbability } from '../lib/rating/logistic-regression';
import { loadWinPredictor } from '../lib/rating/win-predictor-model';
import {
  replayDivision,
  styleSampleFromRow,
  toMatchupProfile,
  averageMatchupProfiles,
  buildMatchupFeaturesFromProfiles,
  minutesFought,
  type ReplayFight,
} from '../lib/rating/win-predictor-features';

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

const WIN_PREDICTOR_PATH = path.resolve('data/ml-models/win-predictor.json');

async function ensureSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS fighter_ratings (
      id SERIAL PRIMARY KEY,
      fighter_id INT NOT NULL REFERENCES fighters(id) ON DELETE CASCADE,
      weight_class VARCHAR(100) NOT NULL,
      points NUMERIC NOT NULL,
      display_score NUMERIC NOT NULL,
      current_streak INT NOT NULL DEFAULT 0,
      is_former_champion BOOLEAN NOT NULL DEFAULT false,
      style_archetype VARCHAR(100),
      fights_rated INT NOT NULL DEFAULT 0,
      last_fight_date VARCHAR(255),
      is_champion BOOLEAN NOT NULL DEFAULT false,
      updated_at TIMESTAMP NOT NULL DEFAULT now(),
      UNIQUE (fighter_id, weight_class)
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS fighter_rating_history (
      id SERIAL PRIMARY KEY,
      fighter_id INT NOT NULL REFERENCES fighters(id) ON DELETE CASCADE,
      weight_class VARCHAR(100) NOT NULL,
      fighter_fight_stats_id INT REFERENCES fighter_fight_stats(id),
      points_before NUMERIC NOT NULL,
      points_after NUMERIC NOT NULL,
      opponent_points_before NUMERIC,
      dominance_score NUMERIC NOT NULL,
      dominance_estimated BOOLEAN NOT NULL DEFAULT false,
      computed_at TIMESTAMP NOT NULL DEFAULT now()
    );
  `;
  // Added 2026-09-17 -- see data/lib/rating/ranking-eligibility.ts.
  await sql`ALTER TABLE fighter_ratings ADD COLUMN IF NOT EXISTS is_ranking_eligible BOOLEAN NOT NULL DEFAULT true`;
  // Added 2026-09-21 -- see data/lib/rating/win-predictor-features.ts.
  await sql`ALTER TABLE fighter_ratings ADD COLUMN IF NOT EXISTS ml_win_probability NUMERIC`;
}

type StatsRow = {
  id: number;
  fighter_id: number;
  fighter_name: string;
  opponent_name: string;
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
  knockdowns: number;
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

type RoundRow = {
  fighter_fight_stats_id: number;
  round: number;
  sig_strikes_landed: number;
  control_time_seconds: number | null;
  knockdowns: number;
};

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
  const todayIso = new Date().toISOString().slice(0, 10);
  // Fail loudly before touching the DB if the trained model is missing/stale.
  const winPredictor = loadWinPredictor(WIN_PREDICTOR_PATH);
  console.log('Ensuring schema...');
  await ensureSchema();

  // fighter_rating_history is a full recomputation every run (not an
  // incremental append) -- fighter_ratings itself upserts by (fighter_id,
  // weight_class) so it self-corrects, but history rows have no natural
  // per-row uniqueness to upsert against, so it's cleared and rebuilt from
  // source data each time, same DELETE-then-insert pattern
  // sync-ufc-rankings.ts already uses for its own fully-recomputed table.
  await sql`DELETE FROM fighter_rating_history`;

  console.log('Loading fighter_fight_stats + fighter_fight_round_stats + fighters + rankings from Neon...');
  const statsRows = (await sql`
    SELECT ffs.id, ffs.fighter_id, f.name AS fighter_name, ffs.opponent_name, ffs.event_date,
           ffs.ufcstats_fight_url, ffs.result, ffs.weight_class, ffs.is_title_fight, ffs.method,
           ffs.finish_round, ffs.finish_time, ffs.scheduled_rounds, ffs.knockdowns,
           ffs.sig_strikes_landed, ffs.control_time_seconds,
           ffs.sig_strikes_head_attempted, ffs.sig_strikes_body_attempted, ffs.sig_strikes_leg_attempted,
           ffs.sig_strikes_distance_attempted, ffs.sig_strikes_clinch_attempted, ffs.sig_strikes_ground_attempted,
           ffs.takedowns_landed, ffs.takedowns_attempted, ffs.submission_attempts
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

  const championIdByDivision = new Map<string, number>();
  const rankingRows = (await sql`
    SELECT weight_class, fighter_id FROM rankings WHERE organization_id = 1 AND rank = 0 AND fighter_id IS NOT NULL
  `) as { weight_class: string; fighter_id: number }[];
  for (const r of rankingRows) championIdByDivision.set(r.weight_class, r.fighter_id);

  const byFightUrl = new Map<string, StatsRow[]>();
  for (const row of statsRows) {
    const list = byFightUrl.get(row.ufcstats_fight_url) ?? [];
    list.push(row);
    byFightUrl.set(row.ufcstats_fight_url, list);
  }

  type Pair = { winner: StatsRow; loser: StatsRow };
  const pairs: Pair[] = [];
  // No contests / draws: no points move, but they count as activity for the
  // inactivity erosion (see DivisionNoResultInput).
  const noResultsByDivision = new Map<string, DivisionNoResultInput[]>();
  Array.from(byFightUrl.values()).forEach((rows) => {
    if (rows.length !== 2) return;
    if (rows.every((r) => r.result === 'nc' || r.result === 'draw') && rows[0].event_date) {
      const division = normalizeWeightClass(rows[0].weight_class ?? '');
      if (!division) return;
      const list = noResultsByDivision.get(division) ?? [];
      list.push({ eventDate: rows[0].event_date, fighterIds: [rows[0].fighter_id, rows[1].fighter_id], isDraw: rows[0].result === 'draw' });
      noResultsByDivision.set(division, list);
      return;
    }
    const winner = rows.find((r) => r.result === 'win');
    const loser = rows.find((r) => r.result === 'loss');
    if (!winner || !loser) return;
    pairs.push({ winner, loser });
  });

  const byDivision = new Map<string, Pair[]>();
  let skippedUnmatchedDivision = 0;
  for (const pair of pairs) {
    const division = normalizeWeightClass(pair.winner.weight_class ?? '');
    if (!division) {
      skippedUnmatchedDivision++;
      continue;
    }
    const list = byDivision.get(division) ?? [];
    list.push(pair);
    byDivision.set(division, list);
  }
  console.log(`Grouped ${pairs.length} fights into ${byDivision.size} divisions (${skippedUnmatchedDivision} skipped -- unmatched weight class).`);

  let totalFightersRated = 0;
  let totalHistoryRows = 0;
  let totalEstimatedFallbacks = 0;

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

    const noResults = (noResultsByDivision.get(division) ?? []).sort((a, b) => (a.eventDate < b.eventDate ? -1 : 1));
    const { fighterStates, history } = simulateDivisionRatings(fights, undefined, noResults);
    // Ranked/displayed points are eroded up to TODAY, not frozen at each
    // fighter's last fight -- otherwise a retired fighter keeps their peak
    // forever (the simulation only erodes someone when they fight again).
    // fighter_rating_history keeps the raw per-fight values.
    const currentPoints = new Map(Array.from(fighterStates.entries()).map(([id, s]) => [id, pointsAsOf(s, todayIso)]));
    // 100 = the best fighter who actually appears in the ranking (active, or
    // the champion). A retired fighter still above that caps at 100 on their
    // own page, flagged as inactive there.
    const eligibleIds = new Set(
      Array.from(fighterStates.entries())
        .filter(([id, s]) => isRankingEligible({ lastFightDate: s.lastFightDate, isChampion: championIdByDivision.get(division) === id }, todayIso))
        .map(([id]) => id),
    );
    const ceilingPool = eligibleIds.size > 0 ? Array.from(eligibleIds, (id) => currentPoints.get(id)!) : Array.from(currentPoints.values());
    const ceiling = Math.max(...ceilingPool, 1e-9);

    // Style features: aggregated across every fight (win or loss) this
    // fighter had in this division -- style is about how they fight, not
    // whether they won. Built from the same `pairs` list (both corners of
    // every fight), not just `sorted`'s winner side.
    const statsIdByFighter = new Map<number, StatsRow[]>();
    for (const p of divisionPairs) {
      for (const row of [p.winner, p.loser]) {
        const list = statsIdByFighter.get(row.fighter_id) ?? [];
        list.push(row);
        statsIdByFighter.set(row.fighter_id, list);
      }
    }
    const fighterIds = Array.from(fighterStates.keys());
    const featuresByFighter = new Map<number, StyleFeatures>();
    for (const fighterId of fighterIds) {
      const rows = statsIdByFighter.get(fighterId) ?? [];
      let totalMinutes = 0;
      const sums = {
        head: 0, body: 0, leg: 0, distance: 0, clinch: 0, ground: 0,
        tdLanded: 0, tdAttempted: 0, control: 0, subAttempts: 0,
      };
      for (const row of rows) {
        const minutes = minutesFought(row.finish_round, row.finish_time);
        totalMinutes += minutes;
        sums.head += row.sig_strikes_head_attempted;
        sums.body += row.sig_strikes_body_attempted;
        sums.leg += row.sig_strikes_leg_attempted;
        sums.distance += row.sig_strikes_distance_attempted;
        sums.clinch += row.sig_strikes_clinch_attempted;
        sums.ground += row.sig_strikes_ground_attempted;
        sums.tdLanded += row.takedowns_landed;
        sums.tdAttempted += row.takedowns_attempted;
        sums.control += row.control_time_seconds ?? 0;
        sums.subAttempts += row.submission_attempts;
      }
      const per15 = (n: number) => (totalMinutes > 0 ? (n / totalMinutes) * 15 : 0);
      featuresByFighter.set(fighterId, {
        sigStrikesHeadRate: per15(sums.head),
        sigStrikesBodyRate: per15(sums.body),
        sigStrikesLegRate: per15(sums.leg),
        sigStrikesDistanceRate: per15(sums.distance),
        sigStrikesClinchRate: per15(sums.clinch),
        sigStrikesGroundRate: per15(sums.ground),
        takedownRate: per15(sums.tdAttempted),
        takedownAccuracy: sums.tdAttempted > 0 ? sums.tdLanded / sums.tdAttempted : 0,
        controlTimeRate: per15(sums.control / 60),
        submissionAttemptRate: per15(sums.subAttempts),
      });
    }
    const archetypeByFighter = new Map<number, string>();
    if (fighterIds.length >= 4) {
      const featureList = fighterIds.map((id) => featuresByFighter.get(id)!);
      const normalized = normalizeFeatures(featureList);
      const { assignments, centroids } = kMeans(normalized, 4);
      const labels = centroids.map((c) => labelCluster(c));
      fighterIds.forEach((id, i) => archetypeByFighter.set(id, labels[assignments[i]]));
    }

    // Win predictor: each fighter's CURRENT state (last-5-fights style, recent
    // performance, activity as of today) vs a synthetic division-average
    // opponent, averaged over the same active pool as the score ceiling.
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
    const runningStates = replayDivision(replayFights);
    const profileByFighter = new Map<number, ReturnType<typeof toMatchupProfile>>();
    for (const [fighterId, running] of Array.from(runningStates.entries())) {
      // The simulation is authoritative for points/streak/champion/last-fight
      // (it also accounts for no contests/draws, which the replay doesn't see).
      const simulated = fighterStates.get(fighterId)!;
      running.points = simulated.points;
      running.currentStreak = simulated.currentStreak;
      running.isFormerChampion = simulated.isFormerChampion;
      running.lastFightDate = simulated.lastFightDate;
      profileByFighter.set(fighterId, toMatchupProfile(running, todayIso));
    }
    const averagePool = eligibleIds.size > 0 ? Array.from(eligibleIds) : Array.from(profileByFighter.keys());
    const divisionAverageProfile = averageMatchupProfiles(averagePool.map((id) => profileByFighter.get(id)!));
    const mlWinProbabilityByFighter = new Map<number, number>();
    for (const [fighterId, profile] of Array.from(profileByFighter.entries())) {
      mlWinProbabilityByFighter.set(fighterId, predictProbability(winPredictor, buildMatchupFeaturesFromProfiles(profile, divisionAverageProfile)));
    }

    // Upsert fighter_ratings.
    for (const fighterId of fighterIds) {
      const state = fighterStates.get(fighterId)!;
      const points = currentPoints.get(fighterId)!;
      const displayScore = Math.min(100, Math.max(0, (points / ceiling) * 100));
      const isChampion = championIdByDivision.get(division) === fighterId;
      await sql`
        INSERT INTO fighter_ratings
          (fighter_id, weight_class, points, display_score, current_streak, is_former_champion,
           style_archetype, fights_rated, last_fight_date, is_champion, is_ranking_eligible, ml_win_probability, updated_at)
        VALUES
          (${fighterId}, ${division}, ${points}, ${displayScore}, ${state.currentStreak}, ${state.isFormerChampion},
           ${archetypeByFighter.get(fighterId) ?? null}, ${state.fightsSimulated}, ${state.lastFightDate}, ${isChampion}, ${eligibleIds.has(fighterId)}, ${mlWinProbabilityByFighter.get(fighterId) ?? null}, now())
        ON CONFLICT (fighter_id, weight_class) DO UPDATE SET
          points = EXCLUDED.points,
          display_score = EXCLUDED.display_score,
          current_streak = EXCLUDED.current_streak,
          is_former_champion = EXCLUDED.is_former_champion,
          style_archetype = EXCLUDED.style_archetype,
          fights_rated = EXCLUDED.fights_rated,
          last_fight_date = EXCLUDED.last_fight_date,
          is_champion = EXCLUDED.is_champion,
          is_ranking_eligible = EXCLUDED.is_ranking_eligible,
          ml_win_probability = EXCLUDED.ml_win_probability,
          updated_at = now()
      `;
      totalFightersRated++;
    }

    // Insert fighter_rating_history: one row per fighter per fight (winner
    // and loser each get their own row for the same fight).
    const statsIdLookup = new Map<string, { winnerId: number; loserId: number }>();
    for (const p of sorted) statsIdLookup.set(p.winner.ufcstats_fight_url, { winnerId: p.winner.id, loserId: p.loser.id });

    for (const entry of history) {
      const ids = statsIdLookup.get(entry.fightUrl);
      await sql`
        INSERT INTO fighter_rating_history
          (fighter_id, weight_class, fighter_fight_stats_id, points_before, points_after,
           opponent_points_before, dominance_score, dominance_estimated, computed_at)
        VALUES
          (${entry.winnerId}, ${division}, ${ids?.winnerId ?? null}, ${entry.winnerPointsBefore}, ${entry.winnerPointsAfter},
           ${entry.loserPointsBefore}, ${entry.dominanceScore}, ${entry.dominanceEstimated}, now())
      `;
      await sql`
        INSERT INTO fighter_rating_history
          (fighter_id, weight_class, fighter_fight_stats_id, points_before, points_after,
           opponent_points_before, dominance_score, dominance_estimated, computed_at)
        VALUES
          (${entry.loserId}, ${division}, ${ids?.loserId ?? null}, ${entry.loserPointsBefore}, ${entry.loserPointsAfter},
           ${entry.winnerPointsBefore}, ${entry.dominanceScore}, ${entry.dominanceEstimated}, now())
      `;
      totalHistoryRows += 2;
      if (entry.dominanceEstimated) totalEstimatedFallbacks++;
    }

    console.log(`  ${division}: ${fighterIds.length} fighters rated, ${history.length} fights processed, champion matched: ${championIdByDivision.has(division)}`);
  }

  console.log(
    `Done. ${totalFightersRated} fighter_ratings row(s) upserted, ${totalHistoryRows} fighter_rating_history row(s) inserted, ` +
      `${totalEstimatedFallbacks} used the dominance-estimated fallback, ${skippedUnmatchedDivision} fights skipped (unmatched weight class).`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
