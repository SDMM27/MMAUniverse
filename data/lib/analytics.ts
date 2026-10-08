// data/lib/analytics.ts
//
// Pure computations behind /analyses. Two sources, never mixed in one figure:
//
// - Results (Sherdog `fights`, every tracked organization, UFC included):
//   method, round, division, plus each fighter's age/height and their whole
//   pro record going in (fighter_fight_history). Everything the organization
//   filter applies to comes from this one source, so "UFC" and "Toutes" stay
//   comparable.
// - Detailed stats (UFCStats `fighter_fight_stats`, UFC only): strikes,
//   takedowns, control time, and reach (only UFCStats publishes it).
//
// No DB access here -- see analytics-data.ts for the queries -- so everything
// is unit-testable on hand-built rows.

import { normalizeWeightClass } from './rating/normalize-weight-class';
import { minutesFought } from './rating/win-predictor-features';
import { normalizeMethodCategory } from './method-category';

export type FinishMethod = 'ko' | 'sub' | 'dec' | 'other';
export type FightResult = 'win' | 'loss' | 'draw' | 'nc';

/** One fighter_fight_stats row joined with that fighter's physique, as fetched by analytics-data.ts. */
export type FightStatsRow = {
  fighter_id: number;
  ufcstats_fight_url: string;
  event_date: string | null;
  result: string | null;
  weight_class: string | null;
  method: string | null;
  finish_round: number | null;
  finish_time: string | null;
  scheduled_rounds: number | null;
  sig_strikes_landed: number;
  sig_strikes_attempted: number;
  takedowns_landed: number;
  takedowns_attempted: number;
  control_time_seconds: number | null;
  knockdowns: number;
  reach_cm: number | null;
  height_cm: number | null;
  /** Age on fight night, computed in SQL (see the DATE gotcha in analytics-data.ts). */
  age_years: number | string | null;
};

export type FightSide = {
  fighterId: number;
  result: FightResult | null;
  reachCm: number | null;
  heightCm: number | null;
  ageYears: number | null;
};

export type AnalyzedFight = {
  url: string;
  date: string;
  year: number;
  /** Canonical division, or null for catchweight / openweight / tournament labels. */
  division: string | null;
  method: FinishMethod;
  endRound: number | null;
  scheduledRounds: number | null;
  minutes: number;
  /** Both corners present, so the summed stats below cover the whole fight. */
  complete: boolean;
  sigLanded: number;
  sigAttempted: number;
  tdLanded: number;
  tdAttempted: number;
  controlSeconds: number;
  knockdowns: number;
  sides: FightSide[];
};

/** UFCStats' method labels ("KO/TKO", "TKO - Doctor's Stoppage", "Decision - Split", ...). */
export function ufcStatsMethod(method: string | null): FinishMethod {
  const normalized = (method ?? '').trim().toLowerCase();
  if (normalized.startsWith('ko') || normalized.startsWith('tko')) return 'ko';
  if (normalized.startsWith('submission')) return 'sub';
  if (normalized.startsWith('decision')) return 'dec';
  return 'other';
}

function toResult(result: string | null): FightResult | null {
  return result === 'win' || result === 'loss' || result === 'draw' || result === 'nc' ? result : null;
}

function toNumber(value: number | string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Folds the per-fighter rows into one record per fight. Rows without a usable date are dropped. */
export function groupFightRows(rows: FightStatsRow[]): AnalyzedFight[] {
  const byUrl = new Map<string, FightStatsRow[]>();
  for (const row of rows) {
    if (!row.event_date || !/^\d{4}-\d{2}-\d{2}$/.test(row.event_date)) continue;
    const list = byUrl.get(row.ufcstats_fight_url);
    if (list) list.push(row);
    else byUrl.set(row.ufcstats_fight_url, [row]);
  }

  const fights: AnalyzedFight[] = [];
  byUrl.forEach((group, url) => {
    const first = group[0];
    const sum = (pick: (row: FightStatsRow) => number | null) => group.reduce((total, row) => total + (pick(row) ?? 0), 0);
    fights.push({
      url,
      date: first.event_date!,
      year: Number(first.event_date!.slice(0, 4)),
      division: first.weight_class ? normalizeWeightClass(first.weight_class) : null,
      method: ufcStatsMethod(first.method),
      endRound: first.finish_round,
      scheduledRounds: first.scheduled_rounds,
      minutes: minutesFought(first.finish_round, first.finish_time),
      complete: group.length === 2,
      sigLanded: sum((row) => row.sig_strikes_landed),
      sigAttempted: sum((row) => row.sig_strikes_attempted),
      tdLanded: sum((row) => row.takedowns_landed),
      tdAttempted: sum((row) => row.takedowns_attempted),
      controlSeconds: sum((row) => row.control_time_seconds),
      knockdowns: sum((row) => row.knockdowns),
      sides: group.slice(0, 2).map((row) => ({
        fighterId: row.fighter_id,
        result: toResult(row.result),
        reachCm: row.reach_cm,
        heightCm: row.height_cm,
        ageYears: toNumber(row.age_years),
      })),
    });
  });
  return fights.sort((a, b) => a.date.localeCompare(b.date) || a.url.localeCompare(b.url));
}

// ---------------------------------------------------------------------------
// Trend cubes: pre-summed per (year, division) so the explorer can re-slice
// by period and division without the raw fights. Same shape for both sources;
// a results cube simply leaves the stats fields at 0.
//
// Each year is split in two at a cutoff day (the day the data is computed, as
// "MM-DD"), so a window counted back from today ("5 ans" = from this date five
// years ago) is exact to the day: it takes the second half of its first year,
// then whole years.
// ---------------------------------------------------------------------------

export const OTHER_DIVISION = 'Autres';

export type TrendCell = {
  year: number;
  division: string;
  /** The fights dated on or after the cutoff day of `year`. */
  afterCutoff: boolean;
  fights: number;
  ko: number;
  sub: number;
  dec: number;
  timedFights: number;
  minutes: number;
  statMinutes: number;
  sigLanded: number;
  sigAttempted: number;
  tdLanded: number;
  tdAttempted: number;
  controlSeconds: number;
  knockdowns: number;
};

export type TrendTotals = Omit<TrendCell, 'year' | 'division' | 'afterCutoff'>;

export function emptyTotals(): TrendTotals {
  return {
    fights: 0, ko: 0, sub: 0, dec: 0, timedFights: 0, minutes: 0, statMinutes: 0,
    sigLanded: 0, sigAttempted: 0, tdLanded: 0, tdAttempted: 0, controlSeconds: 0, knockdowns: 0,
  };
}

export function addTotals(into: TrendTotals, cell: TrendTotals): TrendTotals {
  for (const key of Object.keys(into) as (keyof TrendTotals)[]) into[key] += cell[key];
  return into;
}

/** The cell a fight falls into, created on first use. `cutoff` is "MM-DD". */
function cellFor(cells: Map<string, TrendCell>, fight: { date: string; year: number; division: string | null }, cutoff: string): TrendCell {
  const division = fight.division ?? OTHER_DIVISION;
  const afterCutoff = fight.date.slice(5) >= cutoff;
  const key = `${fight.year}|${division}|${afterCutoff}`;
  let cell = cells.get(key);
  if (!cell) {
    cell = { year: fight.year, division, afterCutoff, ...emptyTotals() };
    cells.set(key, cell);
  }
  return cell;
}

function sortCells(cells: Map<string, TrendCell>): TrendCell[] {
  return Array.from(cells.values()).sort(
    (a, b) => a.year - b.year || Number(a.afterCutoff) - Number(b.afterCutoff) || a.division.localeCompare(b.division),
  );
}

export function buildTrendCube(fights: AnalyzedFight[], cutoff: string): TrendCell[] {
  const cells = new Map<string, TrendCell>();
  for (const fight of fights) {
    const cell = cellFor(cells, fight, cutoff);
    cell.fights += 1;
    if (fight.method === 'ko') cell.ko += 1;
    if (fight.method === 'sub') cell.sub += 1;
    if (fight.method === 'dec') cell.dec += 1;
    if (fight.minutes > 0) {
      cell.timedFights += 1;
      cell.minutes += fight.minutes;
      if (fight.complete) {
        cell.statMinutes += fight.minutes;
        cell.sigLanded += fight.sigLanded;
        cell.sigAttempted += fight.sigAttempted;
        cell.tdLanded += fight.tdLanded;
        cell.tdAttempted += fight.tdAttempted;
        cell.controlSeconds += fight.controlSeconds;
        cell.knockdowns += fight.knockdowns;
      }
    }
  }
  return sortCells(cells);
}

export type TrendMetricId =
  | 'finishRate'
  | 'koShare'
  | 'subShare'
  | 'avgMinutes'
  | 'sigPer15'
  | 'sigAccuracy'
  | 'tdPer15'
  | 'tdAccuracy'
  | 'controlShare'
  | 'kdPer15';

/** 'results' metrics follow the organization filter; 'ufcstats' ones only exist for the UFC. */
export type MetricSource = 'results' | 'ufcstats';
export type TrendMetric = { id: TrendMetricId; label: string; unit: 'percent' | 'number'; source: MetricSource; description: string };

export const TREND_METRICS: TrendMetric[] = [
  { id: 'finishRate', source: 'results', label: 'Taux de finish', unit: 'percent', description: 'Part des combats terminés avant la limite (KO/TKO ou soumission), hors no contest et disqualifications.' },
  { id: 'koShare', source: 'results', label: 'Part de KO/TKO', unit: 'percent', description: 'Part des combats terminés par KO ou TKO, arrêts du médecin compris.' },
  { id: 'subShare', source: 'results', label: 'Part de soumissions', unit: 'percent', description: 'Part des combats terminés par soumission.' },
  { id: 'avgMinutes', source: 'results', label: 'Durée moyenne (min)', unit: 'number', description: 'Durée moyenne d’un combat, en minutes.' },
  { id: 'sigPer15', source: 'ufcstats', label: 'Frappes significatives / 15 min', unit: 'number', description: 'Frappes significatives touchées par combattant, ramenées à 15 minutes de combat.' },
  { id: 'sigAccuracy', source: 'ufcstats', label: 'Précision des frappes', unit: 'percent', description: 'Frappes significatives touchées / tentées.' },
  { id: 'tdPer15', source: 'ufcstats', label: 'Takedowns / 15 min', unit: 'number', description: 'Takedowns réussis par combattant, ramenés à 15 minutes de combat.' },
  { id: 'tdAccuracy', source: 'ufcstats', label: 'Réussite des takedowns', unit: 'percent', description: 'Takedowns réussis / tentés.' },
  { id: 'controlShare', source: 'ufcstats', label: 'Temps de contrôle', unit: 'percent', description: 'Part du temps de combat passée en position de contrôle (au sol ou contre la cage).' },
  { id: 'kdPer15', source: 'ufcstats', label: 'Knockdowns / 15 min', unit: 'number', description: 'Knockdowns par combat, ramenés à 15 minutes.' },
];

/** The metric's value for a slice, or null when the slice has nothing to measure. */
export function trendMetricValue(totals: TrendTotals, metric: TrendMetricId): number | null {
  const ratio = (num: number, den: number) => (den > 0 ? num / den : null);
  const decided = totals.ko + totals.sub + totals.dec;
  switch (metric) {
    case 'finishRate': return ratio(totals.ko + totals.sub, decided);
    case 'koShare': return ratio(totals.ko, decided);
    case 'subShare': return ratio(totals.sub, decided);
    case 'avgMinutes': return ratio(totals.minutes, totals.timedFights);
    // Per fighter: the sums cover both corners, hence the / 2.
    case 'sigPer15': return ratio(totals.sigLanded * 15, totals.statMinutes * 2);
    case 'sigAccuracy': return ratio(totals.sigLanded, totals.sigAttempted);
    case 'tdPer15': return ratio(totals.tdLanded * 15, totals.statMinutes * 2);
    case 'tdAccuracy': return ratio(totals.tdLanded, totals.tdAttempted);
    case 'controlShare': return ratio(totals.controlSeconds, totals.statMinutes * 60);
    case 'kdPer15': return ratio(totals.knockdowns * 15, totals.statMinutes);
  }
}

export function sumCells(cells: TrendCell[], keep: (cell: TrendCell) => boolean = () => true): TrendTotals {
  return cells.reduce((totals, cell) => (keep(cell) ? addTotals(totals, cell) : totals), emptyTotals());
}

// ---------------------------------------------------------------------------
// Results (Sherdog): every tracked organization
// ---------------------------------------------------------------------------

// Sherdog's weight classes don't tell men's and women's divisions apart
// ("Bantamweight" covers both); analytics-data.ts relabels a bout "Women's ..."
// when a corner is known to be a woman (fighters.is_women, inferred from the
// fight graph). Women nobody could place stay in the plain division.
const MEN_DIVISIONS = [
  'Atomweight',
  'Strawweight',
  'Flyweight',
  'Bantamweight',
  'Featherweight',
  'Lightweight',
  'Welterweight',
  'Middleweight',
  'Light Heavyweight',
  'Heavyweight',
] as const;

export const RESULT_DIVISIONS = [
  ...MEN_DIVISIONS,
  ...MEN_DIVISIONS.slice(0, 7).map((division) => `Women's ${division}`),
] as const;

const RESULT_DIVISION_LOOKUP = new Set<string>(RESULT_DIVISIONS);

/** Sherdog weight class -> one of RESULT_DIVISIONS, or null (catchweights, blanks). */
export function normalizeSherdogDivision(raw: string | null): string | null {
  const trimmed = (raw ?? '').trim();
  return RESULT_DIVISION_LOOKUP.has(trimmed) ? trimmed : null;
}

/** One decided Sherdog fight with both corners, as fetched by analytics-data.ts (side 1 / side 2). */
export type ResultFightRow = {
  organization: string;
  date: string;
  weight_class: string | null;
  method: string | null;
  round: number | null;
  time: string | null;
  winner_id: number;
  fighter1_id: number;
  fighter2_id: number;
  height1: number | null;
  height2: number | null;
  age1: number | string | null;
  age2: number | string | null;
  /** Rows in that fighter's Sherdog history at all; 0 means no history was scraped, not a debut. */
  history1: number | string;
  history2: number | string;
  prior_fights1: number | string;
  prior_fights2: number | string;
  last_date1: string | null;
  last_date2: string | null;
  /** That fighter's most recent results before this fight, newest first. */
  recent1: string[] | null;
  recent2: string[] | null;
};

/** A fighter's situation going into a fight, from their pro record (every promotion, not just tracked ones). */
export type PriorRecord = { priorFights: number; streak: number; daysSinceLast: number | null };

export type ResultSide = { won: boolean; ageYears: number | null; heightCm: number | null; prior: PriorRecord | null };

export type ResultFight = {
  organization: string;
  date: string;
  year: number;
  division: string | null;
  method: FinishMethod;
  endRound: number | null;
  minutes: number;
  sides: [ResultSide, ResultSide];
};

/** Wins (> 0) or losses (< 0) in a row, newest first. A no contest is skipped, a draw ends the streak. */
export function streakFrom(recent: string[]): number {
  let streak = 0;
  for (const result of recent) {
    if (result === 'nc') continue;
    if (result === 'win' && streak >= 0) streak += 1;
    else if (result === 'loss' && streak <= 0) streak -= 1;
    else break;
  }
  return streak;
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);
}

function methodFromSherdog(method: string | null): FinishMethod {
  const category = normalizeMethodCategory(method ?? '');
  if (category === 'ko_tko') return 'ko';
  if (category === 'submission') return 'sub';
  if (category === 'decision') return 'dec';
  return 'other';
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseResultRows(rows: ResultFightRow[]): ResultFight[] {
  const side = (row: ResultFightRow, n: 1 | 2): ResultSide => {
    const hasHistory = Number(n === 1 ? row.history1 : row.history2) > 0;
    const lastDate = n === 1 ? row.last_date1 : row.last_date2;
    return {
      won: row.winner_id === (n === 1 ? row.fighter1_id : row.fighter2_id),
      ageYears: toNumber(n === 1 ? row.age1 : row.age2),
      heightCm: n === 1 ? row.height1 : row.height2,
      prior: hasHistory
        ? {
            priorFights: Number(n === 1 ? row.prior_fights1 : row.prior_fights2),
            streak: streakFrom((n === 1 ? row.recent1 : row.recent2) ?? []),
            daysSinceLast: lastDate && ISO_DATE.test(lastDate) ? daysBetween(lastDate, row.date) : null,
          }
        : null,
    };
  };

  return rows
    .filter((row) => ISO_DATE.test(row.date))
    .map((row) => ({
      organization: row.organization,
      date: row.date,
      year: Number(row.date.slice(0, 4)),
      division: normalizeSherdogDivision(row.weight_class),
      method: methodFromSherdog(row.method),
      endRound: row.round,
      minutes: minutesFought(row.round, row.time),
      sides: [side(row, 1), side(row, 2)] as [ResultSide, ResultSide],
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function buildResultCube(fights: ResultFight[], cutoff: string): TrendCell[] {
  const cells = new Map<string, TrendCell>();
  for (const fight of fights) {
    const cell = cellFor(cells, fight, cutoff);
    cell.fights += 1;
    if (fight.method === 'ko') cell.ko += 1;
    if (fight.method === 'sub') cell.sub += 1;
    if (fight.method === 'dec') cell.dec += 1;
    if (fight.minutes > 0) {
      cell.timedFights += 1;
      cell.minutes += fight.minutes;
    }
  }
  return sortCells(cells);
}

export type RoundShare = { round: number; finishes: number; share: number };

/**
 * How finishes spread over rounds 1-5. Sherdog doesn't say whether a fight
 * was scheduled for 3 or 5 rounds, so both formats share one distribution
 * (rounds 4-5 only ever come from 5-round fights).
 */
export function finishesByRound(fights: ResultFight[]): RoundShare[] {
  const counts = [0, 0, 0, 0, 0];
  for (const fight of fights) {
    if (fight.method !== 'ko' && fight.method !== 'sub') continue;
    if (!fight.endRound || fight.endRound < 1 || fight.endRound > 5) continue;
    counts[fight.endRound - 1] += 1;
  }
  const total = counts.reduce((a, b) => a + b, 0);
  return counts.map((finishes, index) => ({ round: index + 1, finishes, share: total > 0 ? finishes / total : 0 }));
}

// ---------------------------------------------------------------------------
// Win factors
// ---------------------------------------------------------------------------

export type FactorBucket = { label: string; short: string; wins: number; total: number };

export type WinFactor = {
  id: string;
  title: string;
  /** What each bar's win rate is the win rate *of*. */
  subject: string;
  buckets: FactorBucket[];
};

type Range = { label: string; short: string; min: number; max: number };

class Buckets {
  private readonly buckets: FactorBucket[];
  constructor(private readonly ranges: Range[]) {
    this.buckets = ranges.map((range) => ({ label: range.label, short: range.short, wins: 0, total: 0 }));
  }
  add(value: number, won: boolean) {
    const index = this.ranges.findIndex((range) => value > range.min && value <= range.max);
    if (index === -1) return;
    this.buckets[index].total += 1;
    if (won) this.buckets[index].wins += 1;
  }
  toJSON(): FactorBucket[] {
    return this.buckets.map((bucket) => ({ ...bucket }));
  }
}

/**
 * "Does the fighter with more X win more often?", by size of the gap. Every
 * fight with both values counts once; equal values are skipped.
 */
function advantage<S>(pairs: { winner: S; loser: S }[], value: (side: S) => number | null, ranges: Range[]): FactorBucket[] {
  const buckets = new Buckets(ranges);
  for (const { winner, loser } of pairs) {
    const a = value(winner);
    const b = value(loser);
    if (a === null || b === null || a === b) continue;
    buckets.add(Math.abs(a - b), a > b);
  }
  return buckets.toJSON();
}

const AGE_RANGES: Range[] = [
  { label: 'Moins de 3 ans', short: '< 3 ans', min: 0, max: 3 },
  { label: '3 à 6 ans', short: '3-6 ans', min: 3, max: 6 },
  { label: '6 à 9 ans', short: '6-9 ans', min: 6, max: 9 },
  { label: '9 ans et plus', short: '9 ans +', min: 9, max: Infinity },
];

const CM_RANGES: Range[] = [
  { label: '1 à 5 cm', short: '1-5 cm', min: 0, max: 5 },
  { label: '6 à 10 cm', short: '6-10 cm', min: 5, max: 10 },
  { label: '11 à 15 cm', short: '11-15 cm', min: 10, max: 15 },
  { label: '16 cm et plus', short: '16 cm +', min: 15, max: Infinity },
];

/** Age, height, experience, streak and layoff, from results (follows the organization filter). */
export function computeWinFactors(fights: ResultFight[]): WinFactor[] {
  const pairs = fights.map((fight) => {
    const [a, b] = fight.sides;
    return a.won ? { winner: a, loser: b } : { winner: b, loser: a };
  });

  const age = advantage(pairs, (side) => (side.ageYears === null ? null : -side.ageYears), AGE_RANGES);
  const height = advantage(pairs, (side) => side.heightCm, CM_RANGES);
  const experience = advantage(pairs, (side) => side.prior?.priorFights ?? null, [
    { label: '1 à 3 combats', short: '1-3', min: 0, max: 3 },
    { label: '4 à 7 combats', short: '4-7', min: 3, max: 7 },
    { label: '8 à 12 combats', short: '8-12', min: 7, max: 12 },
    { label: '13 combats et plus', short: '13 +', min: 12, max: Infinity },
  ]);

  // Streak and layoff describe one fighter's own situation, so each fight
  // contributes both corners (the overall rate is 50% by construction).
  const streak = new Buckets([
    { label: '2 défaites ou plus', short: '2 D +', min: -Infinity, max: -2 },
    { label: '1 défaite', short: '1 D', min: -2, max: -1 },
    { label: '1 victoire', short: '1 V', min: 0, max: 1 },
    { label: '2 victoires', short: '2 V', min: 1, max: 2 },
    { label: '3 à 4 victoires', short: '3-4 V', min: 2, max: 4 },
    { label: '5 victoires ou plus', short: '5 V +', min: 4, max: Infinity },
  ]);
  const layoff = new Buckets([
    { label: 'Moins de 4 mois', short: '< 4 m', min: -Infinity, max: 4 },
    { label: '4 à 8 mois', short: '4-8 m', min: 4, max: 8 },
    { label: '8 à 12 mois', short: '8-12 m', min: 8, max: 12 },
    { label: '1 à 2 ans', short: '1-2 ans', min: 12, max: 24 },
    { label: 'Plus de 2 ans', short: '2 ans +', min: 24, max: Infinity },
  ]);
  for (const fight of fights) {
    for (const side of fight.sides) {
      if (!side.prior) continue;
      if (side.prior.streak !== 0) streak.add(side.prior.streak, side.won);
      if (side.prior.daysSinceLast !== null) layoff.add(side.prior.daysSinceLast / 30.44, side.won);
    }
  }

  return [
    { id: 'age', title: 'L’âge', subject: 'le plus jeune des deux', buckets: age },
    { id: 'height', title: 'La taille', subject: 'le plus grand des deux', buckets: height },
    { id: 'experience', title: 'L’expérience', subject: 'celui qui a le plus de combats pros', buckets: experience },
    { id: 'streak', title: 'La série en cours', subject: 'un combattant dans cette situation', buckets: streak.toJSON() },
    { id: 'layoff', title: 'L’inactivité', subject: 'un combattant après cette pause', buckets: layoff.toJSON() },
  ];
}

/** Reach advantage, from UFCStats (the only source that publishes reach, so UFC only). */
export function computeReachFactor(fights: AnalyzedFight[]): WinFactor {
  const pairs: { winner: FightSide; loser: FightSide }[] = [];
  for (const fight of fights) {
    if (fight.sides.length !== 2) continue;
    const winner = fight.sides.find((side) => side.result === 'win');
    const loser = fight.sides.find((side) => side.result === 'loss');
    if (winner && loser) pairs.push({ winner, loser });
  }
  return { id: 'reach', title: 'L’allonge', subject: 'celui qui a la plus grande allonge', buckets: advantage(pairs, (side) => side.reachCm, CM_RANGES) };
}

// ---------------------------------------------------------------------------
// Organizations compared
// ---------------------------------------------------------------------------

export type OrgFinishRow = { organization: string; fights: number; ko: number; sub: number; dec: number };

export function orgFinishRates(fights: ResultFight[], sinceYear: number, minFights: number): OrgFinishRow[] {
  const byOrg = new Map<string, OrgFinishRow>();
  for (const fight of fights) {
    if (fight.year < sinceYear || fight.method === 'other') continue;
    let org = byOrg.get(fight.organization);
    if (!org) {
      org = { organization: fight.organization, fights: 0, ko: 0, sub: 0, dec: 0 };
      byOrg.set(fight.organization, org);
    }
    org.fights += 1;
    org[fight.method] += 1;
  }
  return Array.from(byOrg.values())
    .filter((org) => org.fights >= minFights)
    .sort((a, b) => (b.ko + b.sub) / b.fights - (a.ko + a.sub) / a.fights);
}
