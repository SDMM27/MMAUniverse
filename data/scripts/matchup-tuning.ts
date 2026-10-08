// data/scripts/matchup-tuning.ts
//
// What tune-matchup and tune-glicko-matchup share: every decided UFC fight
// with both fighters' matchup profiles as of fight night (age, reach, layoff,
// UFCStats career sums from fights strictly before that date), the pre-fight
// Glicko odds of a given career simulation attached to it, and the fit and
// scoring of the matchup layer on top. Corner A is the lower fighter id, so
// who won never decides the orientation. Read-only against Neon.
import { neon } from '@neondatabase/serverless';
import { loadData, loadEnvLocal, toCareerInputs } from './tuning-data';
import type { CareerFightInput, CareerHistoryEntry, CareerNoResultInput } from '../lib/rating/simulate-career';
import { predictFight } from '../lib/rating/simulate-fight';
import type { GlickoRating } from '../lib/rating/glicko-rating';
import {
  MATCHUP_SHAPE,
  MATCHUP_TERMS,
  addFightToProfile,
  emptyMatchupProfile,
  fightMinutes,
  fitMatchupWeights,
  matchupFeatures,
  scoreMatchup,
  type MatchupModel,
  type MatchupProfile,
  type MatchupTerm,
} from '../lib/rating/matchup-model';

export const TEST_SHARE = 0.2;
export const WINDOWS: [string, string][] = [
  ['2017-01-01', '2019-01-01'],
  ['2019-01-01', '2021-01-01'],
  ['2021-01-01', '2023-06-01'],
  ['2023-06-01', '9999-12-31'],
];

export type StatRow = {
  fighter_id: number;
  event_date: string;
  ufcstats_fight_url: string;
  finish_round: number | null;
  finish_time: string | null;
  knockdowns: number;
  sig_strikes_landed: number;
  control_time_seconds: number | null;
};

// One decided fight, everything but the rating: that depends on the Glicko params replayed.
export type MatchupContext = { fightUrl: string; date: string; idA: number; idB: number; a: MatchupProfile; b: MatchupProfile; aWon: boolean };
export type Sample = {
  date: string;
  ratingWinA: number;
  ratingA: GlickoRating;
  ratingB: GlickoRating;
  a: MatchupProfile;
  b: MatchupProfile;
  aWon: boolean;
  debut: boolean; // either fighter's first UFC fight
};

const yearsBetween = (fromIso: string, toIso: string) => (Date.parse(toIso) - Date.parse(fromIso)) / (365.25 * 86400e3);
const monthsBetween = (fromIso: string, toIso: string) => (Date.parse(toIso) - Date.parse(fromIso)) / (30.44 * 86400e3);

/**
 * Replays the UFCStats rows in date order into a context per decided fight
 * (those in `fights`; no contests and draws still add to the careers).
 */
export function buildMatchupContexts(fights: CareerFightInput[], stats: StatRow[], birth: Map<number, string>, reach: Map<number, number>): MatchupContext[] {
  const decided = new Map(fights.map((f) => [f.fightUrl, f]));
  const byUrl = new Map<string, StatRow[]>();
  for (const row of stats) byUrl.set(row.ufcstats_fight_url, [...(byUrl.get(row.ufcstats_fight_url) ?? []), row]);
  const pairs = Array.from(byUrl.values())
    .filter((p) => p.length === 2)
    .sort((x, y) => (x[0].event_date < y[0].event_date ? -1 : x[0].event_date > y[0].event_date ? 1 : 0));

  const careers = new Map<number, MatchupProfile>();
  const lastFight = new Map<number, string>();
  const asOf = (id: number, date: string): MatchupProfile => ({
    ...(careers.get(id) ?? emptyMatchupProfile()),
    age: birth.has(id) ? yearsBetween(birth.get(id)!, date) : null,
    reachCm: reach.get(id) ?? null,
    monthsSinceLastFight: lastFight.has(id) ? monthsBetween(lastFight.get(id)!, date) : null,
  });

  const contexts: MatchupContext[] = [];
  for (let i = 0; i < pairs.length; ) {
    const date = pairs[i][0].event_date;
    const day: StatRow[][] = [];
    while (i < pairs.length && pairs[i][0].event_date === date) day.push(pairs[i++]);
    // Read every fight of the day before adding any of them in.
    for (const pair of day) {
      const fight = decided.get(pair[0].ufcstats_fight_url);
      if (!fight) continue; // no contest, draw, or outside a known division
      const aIsWinner = fight.winnerId < fight.loserId;
      const [idA, idB] = aIsWinner ? [fight.winnerId, fight.loserId] : [fight.loserId, fight.winnerId];
      contexts.push({ fightUrl: fight.fightUrl, date, idA, idB, a: asOf(idA, date), b: asOf(idB, date), aWon: aIsWinner });
    }
    for (const [me, opp] of day.flatMap((p) => [[p[0], p[1]], [p[1], p[0]]])) {
      careers.set(
        me.fighter_id,
        addFightToProfile(careers.get(me.fighter_id) ?? emptyMatchupProfile(), {
          minutes: fightMinutes(me.finish_round, me.finish_time),
          sigStrikesLanded: me.sig_strikes_landed,
          sigStrikesAbsorbed: opp.sig_strikes_landed,
          controlSeconds: me.control_time_seconds ?? 0,
          controlledSeconds: opp.control_time_seconds ?? 0,
          knockdownsAbsorbed: opp.knockdowns,
        }),
      );
      lastFight.set(me.fighter_id, date);
    }
  }
  return contexts;
}

/** The fights the Glicko replays (cached, see tuning-data) and their matchup contexts (UFCStats rows + fighters, from Neon). */
export async function loadMatchupData(): Promise<{ fights: CareerFightInput[]; noResults: CareerNoResultInput[]; contexts: MatchupContext[] }> {
  const { fights, noResults } = toCareerInputs(await loadData());
  loadEnvLocal();
  const sql = neon(process.env.DATABASE_URL!);
  console.log('Loading fighter_fight_stats + fighters from Neon...');
  const stats = (await sql`
    SELECT fighter_id, event_date, ufcstats_fight_url, finish_round, finish_time, knockdowns, sig_strikes_landed, control_time_seconds
    FROM fighter_fight_stats WHERE event_date IS NOT NULL
  `) as StatRow[];
  // birth_date as text: the driver turns a DATE into a local-midnight Date (see fighter-physique notes).
  const fighters = (await sql`SELECT id, birth_date::text AS birth_date, reach_cm FROM fighters`) as { id: number; birth_date: string | null; reach_cm: number | null }[];
  const birth = new Map(fighters.filter((f) => f.birth_date).map((f) => [f.id, f.birth_date!]));
  const reach = new Map(fighters.filter((f) => f.reach_cm).map((f) => [f.id, Number(f.reach_cm)]));
  return { fights, noResults, contexts: buildMatchupContexts(fights, stats, birth, reach) };
}

/** Each context with the pre-fight odds of one career simulation, as the simulator computes them (predictFight). */
export function attachRatings(contexts: MatchupContext[], history: CareerHistoryEntry[]): Sample[] {
  const byUrl = new Map(history.map((e) => [e.fightUrl, e]));
  return contexts.flatMap((c) => {
    const e = byUrl.get(c.fightUrl);
    if (!e) return [];
    const [ra, rb] = c.aWon ? [e.winnerBefore, e.loserBefore] : [e.loserBefore, e.winnerBefore];
    return [{ date: c.date, ratingWinA: predictFight(ra, rb).winA, ratingA: ra, ratingB: rb, a: c.a, b: c.b, aWon: c.aWon, debut: e.winnerUfcFightsBefore === 0 || e.loserUfcFightsBefore === 0 }];
  });
}

/** The date the most recent TEST_SHARE of fights starts at. */
export function testFromDateOf(samples: { date: string }[]): string {
  const dates = samples.map((s) => s.date).sort();
  return dates[Math.floor(dates.length * (1 - TEST_SHARE))];
}

export const shape = (veteranAge: number) => ({ veteranAge, ...MATCHUP_SHAPE });
const toFit = (samples: Sample[], veteranAge: number) => samples.map((s) => ({ x: matchupFeatures(s.ratingWinA, s.a, s.b, shape(veteranAge)), aWon: s.aWon }));

export const fit = (samples: Sample[], veteranAge: number, terms: readonly MatchupTerm[] = MATCHUP_TERMS): MatchupModel => ({
  weights: fitMatchupWeights(toFit(samples, veteranAge), terms),
  ...shape(veteranAge),
});

export type Metrics = { logLoss: number; accuracy: number };

export function metrics(samples: Sample[], predict: (s: Sample) => number): Metrics {
  let logLoss = 0;
  let correct = 0;
  for (const s of samples) {
    const p = predict(s);
    logLoss -= Math.log(Math.max(s.aWon ? p : 1 - p, 1e-12));
    correct += p === 0.5 ? 0.5 : (p > 0.5) === s.aWon ? 1 : 0;
  }
  return { logLoss: logLoss / samples.length, accuracy: correct / samples.length };
}

export const withModel = (model: MatchupModel) => (s: Sample) => scoreMatchup(matchupFeatures(s.ratingWinA, s.a, s.b, model), model);

/** Trained on every fight before each window, tested inside it: a gain that only shows up once is visible as such. */
export function windowMetrics(samples: Sample[], veteranAge: number, terms: readonly MatchupTerm[] = MATCHUP_TERMS) {
  return WINDOWS.map(([from, to]) => {
    const inside = samples.filter((s) => s.date >= from && s.date < to);
    return { from, to, count: inside.length, ...metrics(inside, withModel(fit(samples.filter((s) => s.date < from), veteranAge, terms))) };
  });
}

export const line = (label: string, m: Metrics) => console.log(`  ${label.padEnd(30)} log-loss ${m.logLoss.toFixed(4)}   accuracy ${(m.accuracy * 100).toFixed(1)}%`);
