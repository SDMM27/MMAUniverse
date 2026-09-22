// data/scripts/tuning-data.ts
//
// Loads every decided UFC fight (and no contest / draw) grouped by division,
// with the same query/pairing/grouping as compute-fighter-ratings.ts, cached
// in data/scraped/.cache/ -- shared by the tuning scripts (tune-point-flow,
// tune-glicko) and check-ratings so they all judge the same fights.
// Read-only against Neon. Extracted from tune-point-flow.ts (2026-09-22).
import fs from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';
import { normalizeWeightClass } from '../lib/rating/normalize-weight-class';
import type { DivisionFightInput, DivisionNoResultInput } from '../lib/rating/simulate-division';
import type { FightStatsSide, RoundStatsSide } from '../lib/rating/dominance-score';
import type { CareerFightInput, CareerNoResultInput } from '../lib/rating/simulate-career';

const CACHE_FILE = path.resolve('data/scraped/.cache/point-flow-tuning-fights.json');

export function loadEnvLocal() {
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

type StatsRow = {
  id: number;
  fighter_id: number;
  fighter_name: string;
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

type RoundRow = { fighter_fight_stats_id: number; round: number; sig_strikes_landed: number; control_time_seconds: number | null; knockdowns: number };

export type LoadedData = { divisions: { name: string; fights: DivisionFightInput[]; noResults: DivisionNoResultInput[] }[]; fighterNames: Record<number, string> };

function toFightStatsSide(row: StatsRow, rounds: RoundRow[]): FightStatsSide {
  const roundSides: RoundStatsSide[] = rounds
    .slice()
    .sort((a, b) => a.round - b.round)
    .map((r) => ({ round: r.round, sigStrikesLanded: r.sig_strikes_landed, controlTimeSeconds: r.control_time_seconds, knockdowns: r.knockdowns }));
  return {
    method: row.method ?? '',
    finishRound: row.finish_round,
    sigStrikesLandedTotal: row.sig_strikes_landed,
    controlTimeSecondsTotal: row.control_time_seconds,
    rounds: roundSides,
  };
}

/** Same query/pairing/grouping as compute-fighter-ratings.ts. */
async function loadFromNeon(): Promise<LoadedData> {
  loadEnvLocal();
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set (expected in .env.local)');
    process.exit(1);
  }
  const sql = neon(process.env.DATABASE_URL);
  console.log('Loading fighter_fight_stats + fighter_fight_round_stats from Neon...');
  const statsRows = (await sql`
    SELECT ffs.id, ffs.fighter_id, f.name AS fighter_name, ffs.event_date, ffs.ufcstats_fight_url, ffs.result, ffs.weight_class,
           ffs.is_title_fight, ffs.method, ffs.finish_round, ffs.scheduled_rounds, ffs.sig_strikes_landed, ffs.control_time_seconds
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
  const fighterNames: Record<number, string> = {};
  for (const row of statsRows) {
    fighterNames[row.fighter_id] = row.fighter_name;
    const list = byFightUrl.get(row.ufcstats_fight_url) ?? [];
    list.push(row);
    byFightUrl.set(row.ufcstats_fight_url, list);
  }

  const byDivision = new Map<string, { winner: StatsRow; loser: StatsRow }[]>();
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
    if (!winner || !loser || !winner.event_date) return;
    const division = normalizeWeightClass(winner.weight_class ?? '');
    if (!division) return;
    const list = byDivision.get(division) ?? [];
    list.push({ winner, loser });
    byDivision.set(division, list);
  });

  const divisions = Array.from(byDivision.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([name, pairs]) => ({
      name,
      noResults: (noResultsByDivision.get(name) ?? []).sort((a, b) => (a.eventDate < b.eventDate ? -1 : 1)),
      fights: pairs
        .sort((a, b) => (a.winner.event_date! < b.winner.event_date! ? -1 : 1))
        .map((p) => ({
          fightUrl: p.winner.ufcstats_fight_url,
          eventDate: p.winner.event_date!,
          isTitleFight: p.winner.is_title_fight ?? false,
          isFiveRounds: p.winner.scheduled_rounds === 5,
          winnerId: p.winner.fighter_id,
          loserId: p.loser.fighter_id,
          winnerSide: toFightStatsSide(p.winner, roundsByStatsId.get(p.winner.id) ?? []),
          loserSide: toFightStatsSide(p.loser, roundsByStatsId.get(p.loser.id) ?? []),
        })),
    }));
  return { divisions, fighterNames };
}

export async function loadData(): Promise<LoadedData> {
  if (!process.argv.includes('--refresh') && fs.existsSync(CACHE_FILE)) {
    const cached = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8')) as LoadedData;
    if (cached.divisions.every((d) => Array.isArray(d.noResults))) {
    console.log(`Using cached fights from ${path.relative(process.cwd(), CACHE_FILE)} (pass --refresh to re-fetch).`);
      return cached;
    }
    console.log('Cache predates no-contest support, re-fetching.');
  }
  const data = await loadFromNeon();
  fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(data));
  return data;
}


/** Every division's fights merged into one chronological list, each tagged with its division -- the input simulateCareerRatings expects. */
export function toCareerInputs(data: LoadedData): { fights: CareerFightInput[]; noResults: CareerNoResultInput[] } {
  const byDate = <T extends { eventDate: string }>(a: T, b: T) => (a.eventDate < b.eventDate ? -1 : a.eventDate > b.eventDate ? 1 : 0);
  return {
    fights: data.divisions.flatMap((d) => d.fights.map((f) => ({ ...f, division: d.name }))).sort(byDate),
    noResults: data.divisions.flatMap((d) => d.noResults.map((n) => ({ ...n, division: d.name }))).sort(byDate),
  };
}
