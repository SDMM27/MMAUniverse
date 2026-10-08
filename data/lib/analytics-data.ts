// data/lib/analytics-data.ts
//
// Queries behind /analyses. Everything is computed in one pass for every
// organization at once (the page's organization filter just picks a slice),
// then cached for a few hours: the underlying data only moves with the daily
// Sherdog sync and the weekly UFCStats sync anyway.

import { unstable_cache } from 'next/cache';
import { sql } from './db';
import {
  buildResultCube,
  buildTrendCube,
  computeReachFactor,
  computeWinFactors,
  finishesByRound,
  groupFightRows,
  orgFinishRates,
  OTHER_DIVISION,
  parseResultRows,
  RESULT_DIVISIONS,
  type FightStatsRow,
  type OrgFinishRow,
  type ResultFight,
  type ResultFightRow,
  type RoundShare,
  type TrendCell,
  type WinFactor,
} from './analytics';
import { sortWeightClassGroups } from './rating/order-division';

export const ALL_ORGS = 'all';
export const DEFAULT_ORG = 'UFC';

const ORG_LABELS: Record<string, string> = {
  [ALL_ORGS]: 'Toutes',
  HMMA: 'Hexagone',
  OKTAGON: 'Oktagon',
  ARES: 'Ares',
  RIZIN: 'Rizin',
  CW: 'Cage Warriors',
};

export function orgLabel(key: string): string {
  return ORG_LABELS[key] ?? key;
}

/** One organization's (or every organization's) results, from Sherdog. */
export type OrgAnalytics = {
  key: string;
  label: string;
  cube: TrendCell[];
  divisions: string[];
  rounds: RoundShare[];
  factors: WinFactor[];
  fightCount: number;
  firstYear: number;
};

/** UFC-only figures from UFCStats: detailed stats and reach. */
export type UfcStatsAnalytics = {
  cube: TrendCell[];
  divisions: string[];
  reach: WinFactor;
  fightCount: number;
};

export type AnalyticsData = {
  orgOptions: { key: string; label: string; fights: number }[];
  byOrg: Record<string, OrgAnalytics>;
  ufcStats: UfcStatsAnalytics;
  orgComparison: OrgFinishRow[];
  orgComparisonSince: number;
  lastDate: string;
  /** The day this was computed ("YYYY-MM-DD", UTC): rolling windows in the explorer count back from it. */
  asOf: string;
};

// An organization gets its own filter entry once it has this many decided
// fights; smaller ones (recently added to the scraper) still count in "Toutes".
const MIN_FIGHTS_FOR_FILTER = 300;
// Sherdog only has full history for some promotions; comparing every one of
// them over the same recent window keeps the UFC's 1990s out of its average.
const COMPARISON_SINCE_YEAR = 2016;
const COMPARISON_MIN_FIGHTS = 150;

function summarize(key: string, fights: ResultFight[], cutoff: string): OrgAnalytics {
  const cube = buildResultCube(fights, cutoff);
  const present = new Set(cube.map((cell) => cell.division));
  return {
    key,
    label: orgLabel(key),
    cube,
    divisions: RESULT_DIVISIONS.filter((division) => present.has(division)),
    rounds: finishesByRound(fights),
    factors: computeWinFactors(fights),
    fightCount: fights.length,
    firstYear: fights[0]?.year ?? new Date().getUTCFullYear(),
  };
}

async function loadAnalytics(): Promise<AnalyticsData> {
  const asOf = new Date().toISOString().slice(0, 10);
  const cutoff = asOf.slice(5);
  try {
    // Ages are computed in SQL: the neon driver hands a DATE back as a JS Date
    // at local midnight, which drifts a day once serialized. Each corner's pro
    // record going in comes from their Sherdog history (every promotion they
    // fought in, tracked or not), strictly before the fight's date.
    const [resultRows, statsRows] = await Promise.all([
      sql<ResultFightRow>`
        SELECT o.abbreviation AS organization, e.date,
               CASE WHEN a.is_women OR b.is_women THEN 'Women''s ' || f.weight_class ELSE f.weight_class END AS weight_class,
               f.method, f.round, f.time,
               f.winner_id, f.fighter1_id, f.fighter2_id,
               a.height_cm AS height1, b.height_cm AS height2,
               CASE WHEN a.birth_date IS NOT NULL THEN ROUND(((e.date::date - a.birth_date) / 365.25)::numeric, 2) END AS age1,
               CASE WHEN b.birth_date IS NOT NULL THEN ROUND(((e.date::date - b.birth_date) / 365.25)::numeric, 2) END AS age2,
               p1.history AS history1, p1.prior_fights AS prior_fights1, p1.last_date AS last_date1, p1.recent AS recent1,
               p2.history AS history2, p2.prior_fights AS prior_fights2, p2.last_date AS last_date2, p2.recent AS recent2
        FROM fights f
        JOIN events e ON e.id = f.event_id
        JOIN organizations o ON o.id = e.organization_id
        JOIN fighters a ON a.id = f.fighter1_id
        JOIN fighters b ON b.id = f.fighter2_id
        LEFT JOIN LATERAL (
          SELECT COUNT(*) AS history,
                 COUNT(*) FILTER (WHERE h.event_date < e.date) AS prior_fights,
                 MAX(h.event_date) FILTER (WHERE h.event_date < e.date) AS last_date,
                 (ARRAY_AGG(h.result ORDER BY h.event_date DESC) FILTER (WHERE h.event_date < e.date))[1:12] AS recent
          FROM fighter_fight_history h
          WHERE h.fighter_id = f.fighter1_id AND h.event_date ~ '^\\d{4}-\\d{2}-\\d{2}$'
        ) p1 ON true
        LEFT JOIN LATERAL (
          SELECT COUNT(*) AS history,
                 COUNT(*) FILTER (WHERE h.event_date < e.date) AS prior_fights,
                 MAX(h.event_date) FILTER (WHERE h.event_date < e.date) AS last_date,
                 (ARRAY_AGG(h.result ORDER BY h.event_date DESC) FILTER (WHERE h.event_date < e.date))[1:12] AS recent
          FROM fighter_fight_history h
          WHERE h.fighter_id = f.fighter2_id AND h.event_date ~ '^\\d{4}-\\d{2}-\\d{2}$'
        ) p2 ON true
        WHERE f.fight_finished AND f.winner_id IN (f.fighter1_id, f.fighter2_id)
          AND e.date ~ '^\\d{4}-\\d{2}-\\d{2}$' AND e.date <= to_char(now(), 'YYYY-MM-DD')
      `,
      sql<FightStatsRow>`
        SELECT s.fighter_id, s.ufcstats_fight_url, s.event_date, s.result, s.weight_class, s.method,
               s.finish_round, s.finish_time, s.scheduled_rounds,
               s.sig_strikes_landed, s.sig_strikes_attempted, s.takedowns_landed, s.takedowns_attempted,
               s.control_time_seconds, s.knockdowns,
               f.reach_cm, f.height_cm, NULL AS age_years
        FROM fighter_fight_stats s
        JOIN fighters f ON f.id = s.fighter_id
      `,
    ]);

    const results = parseResultRows(resultRows.rows);
    const byOrgFights = new Map<string, ResultFight[]>();
    for (const fight of results) {
      const list = byOrgFights.get(fight.organization);
      if (list) list.push(fight);
      else byOrgFights.set(fight.organization, [fight]);
    }

    const filterable = Array.from(byOrgFights.entries())
      .filter(([, fights]) => fights.length >= MIN_FIGHTS_FOR_FILTER)
      .sort(([keyA, a], [keyB, b]) => Number(keyB === DEFAULT_ORG) - Number(keyA === DEFAULT_ORG) || b.length - a.length);

    const byOrg: Record<string, OrgAnalytics> = { [ALL_ORGS]: summarize(ALL_ORGS, results, cutoff) };
    for (const [key, fights] of filterable) byOrg[key] = summarize(key, fights, cutoff);

    const statFights = groupFightRows(statsRows.rows);
    const statCube = buildTrendCube(statFights, cutoff);
    const statDivisions = sortWeightClassGroups(
      Array.from(new Set(statCube.map((cell) => cell.division)))
        .filter((division) => division !== OTHER_DIVISION)
        .map((weightClass) => ({ weightClass })),
    ).map((group) => group.weightClass);

    return {
      orgOptions: [
        ...filterable.map(([key, fights]) => ({ key, label: orgLabel(key), fights: fights.length })),
        { key: ALL_ORGS, label: orgLabel(ALL_ORGS), fights: results.length },
      ],
      byOrg,
      ufcStats: { cube: statCube, divisions: statDivisions, reach: computeReachFactor(statFights), fightCount: statFights.length },
      orgComparison: orgFinishRates(results, COMPARISON_SINCE_YEAR, COMPARISON_MIN_FIGHTS),
      orgComparisonSince: COMPARISON_SINCE_YEAR,
      lastDate: results.at(-1)?.date ?? '',
      asOf,
    };
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch the analytics data.');
  }
}

// Bump the key whenever AnalyticsData's shape changes, or a deploy keeps
// serving the previous shape from the cache for up to `revalidate`.
export const fetchAnalytics = unstable_cache(loadAnalytics, ['analytics-v5'], { revalidate: 6 * 60 * 60 });
