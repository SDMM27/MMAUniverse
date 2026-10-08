// data/scripts/tune-matchup.ts
//
// `npm run tune:matchup`: fits and validates the fight simulator's matchup
// layer (data/lib/rating/matchup-model.ts). Replays every UFC fight in date
// order: the pre-fight odds exactly as the simulator computes them
// (predictFight on the Glicko career simulation of compute-fighter-ratings),
// each fighter's age on fight night, and their UFCStats career sums from
// fights strictly before that date. Corner A is the lower fighter id, so who
// won never decides the orientation.
//   - veteranAge is picked, and the weights fitted, on fights before the most
//     recent TEST_SHARE; the held-out fights are reported against the rating
//     alone and the age-only layer,
//   - the same fit is repeated on four time windows, so a gain that only
//     shows up once is visible as such,
//   - the shipped weights are refit on every fight and written to
//     data/ml-models/fight-matchup-model.json.
// Read-only against Neon.
import fs from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';
import { loadData, loadEnvLocal, toCareerInputs } from './tuning-data';
import { simulateCareerRatings } from '../lib/rating/simulate-career';
import { predictFight } from '../lib/rating/simulate-fight';
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

const OUTPUT_FILE = path.resolve('data/ml-models/fight-matchup-model.json');
const TEST_SHARE = 0.2;
const VETERAN_AGES = [29, 30, 31, 32, 33, 34, 35];
const WINDOWS: [string, string][] = [
  ['2017-01-01', '2019-01-01'],
  ['2019-01-01', '2021-01-01'],
  ['2021-01-01', '2023-06-01'],
  ['2023-06-01', '9999-12-31'],
];
const AGE_TERMS: MatchupTerm[] = ['rating', 'age', 'veteran'];

type StatRow = {
  fighter_id: number;
  event_date: string;
  ufcstats_fight_url: string;
  finish_round: number | null;
  finish_time: string | null;
  knockdowns: number;
  sig_strikes_landed: number;
  control_time_seconds: number | null;
};
type Sample = { date: string; ratingWinA: number; a: MatchupProfile; b: MatchupProfile; aWon: boolean };

const yearsBetween = (fromIso: string, toIso: string) => (Date.parse(toIso) - Date.parse(fromIso)) / (365.25 * 86400e3);
const monthsBetween = (fromIso: string, toIso: string) => (Date.parse(toIso) - Date.parse(fromIso)) / (30.44 * 86400e3);

async function loadSamples(): Promise<Sample[]> {
  const { fights, noResults } = toCareerInputs(await loadData());
  const historyByUrl = new Map(simulateCareerRatings(fights, noResults).history.map((e) => [e.fightUrl, e]));

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

  const samples: Sample[] = [];
  for (let i = 0; i < pairs.length; ) {
    const date = pairs[i][0].event_date;
    const day: StatRow[][] = [];
    while (i < pairs.length && pairs[i][0].event_date === date) day.push(pairs[i++]);
    // Read every fight of the day before adding any of them in.
    for (const pair of day) {
      const e = historyByUrl.get(pair[0].ufcstats_fight_url);
      if (!e) continue; // no contest, draw, or outside a known division
      const aIsWinner = e.winnerId < e.loserId;
      const [ra, rb] = aIsWinner ? [e.winnerBefore, e.loserBefore] : [e.loserBefore, e.winnerBefore];
      const [idA, idB] = aIsWinner ? [e.winnerId, e.loserId] : [e.loserId, e.winnerId];
      samples.push({ date, ratingWinA: predictFight(ra, rb).winA, a: asOf(idA, date), b: asOf(idB, date), aWon: aIsWinner });
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
  return samples;
}

const shape = (veteranAge: number) => ({ veteranAge, ...MATCHUP_SHAPE });
const toFit = (samples: Sample[], veteranAge: number) => samples.map((s) => ({ x: matchupFeatures(s.ratingWinA, s.a, s.b, shape(veteranAge)), aWon: s.aWon }));
const fit = (samples: Sample[], veteranAge: number, terms: readonly MatchupTerm[] = MATCHUP_TERMS): MatchupModel => ({
  weights: fitMatchupWeights(toFit(samples, veteranAge), terms),
  ...shape(veteranAge),
});

function metrics(samples: Sample[], predict: (s: Sample) => number) {
  let logLoss = 0;
  let correct = 0;
  for (const s of samples) {
    const p = predict(s);
    logLoss -= Math.log(Math.max(s.aWon ? p : 1 - p, 1e-12));
    correct += p === 0.5 ? 0.5 : (p > 0.5) === s.aWon ? 1 : 0;
  }
  return { logLoss: logLoss / samples.length, accuracy: correct / samples.length };
}
const withModel = (model: MatchupModel) => (s: Sample) => scoreMatchup(matchupFeatures(s.ratingWinA, s.a, s.b, model), model);
const line = (label: string, m: { logLoss: number; accuracy: number }) =>
  console.log(`  ${label.padEnd(26)} log-loss ${m.logLoss.toFixed(4)}   accuracy ${(m.accuracy * 100).toFixed(1)}%`);

async function main() {
  const samples = await loadSamples();
  const dates = samples.map((s) => s.date).sort();
  const testFromDate = dates[Math.floor(dates.length * (1 - TEST_SHARE))];
  const train = samples.filter((s) => s.date < testFromDate);
  const test = samples.filter((s) => s.date >= testFromDate);
  console.log(`${samples.length} decided UFC fights. Training before ${testFromDate} (${train.length}), testing from it (${test.length}).\n`);

  let best: { model: MatchupModel; logLoss: number } | null = null;
  for (const veteranAge of VETERAN_AGES) {
    const model = fit(train, veteranAge);
    const { logLoss } = metrics(train, withModel(model));
    console.log(`  veteranAge ${veteranAge}: train log-loss ${logLoss.toFixed(4)}`);
    if (!best || logLoss < best.logLoss) best = { model, logLoss };
  }
  const { veteranAge } = best!.model;

  const report = {
    count: test.length,
    ratingAlone: metrics(test, (s) => s.ratingWinA),
    ageOnly: metrics(test, withModel(fit(train, veteranAge, AGE_TERMS))),
    full: metrics(test, withModel(best!.model)),
  };
  console.log(`\nTrained weights: ${JSON.stringify(best!.model.weights)}`);
  console.log(`\nHeld-out (${report.count} fights from ${testFromDate}):`);
  line('predictFight', report.ratingAlone);
  line('+ age (previous layer)', report.ageOnly);
  line('+ every factor', report.full);

  console.log('\nSame comparison, trained before each window and tested inside it:');
  const windows = WINDOWS.map(([from, to]) => {
    const before = samples.filter((s) => s.date < from);
    const inside = samples.filter((s) => s.date >= from && s.date < to);
    const ageOnly = metrics(inside, withModel(fit(before, veteranAge, AGE_TERMS)));
    const full = metrics(inside, withModel(fit(before, veteranAge)));
    console.log(
      `  ${from} -> ${to.slice(0, 4) === '9999' ? 'today' : to}  (${inside.length})  log-loss ${ageOnly.logLoss.toFixed(4)} -> ${full.logLoss.toFixed(4)}   accuracy ${(ageOnly.accuracy * 100).toFixed(1)}% -> ${(full.accuracy * 100).toFixed(1)}%`,
    );
    return { from, to, count: inside.length, ageOnly, full };
  });

  const shipped = fit(samples, veteranAge);
  console.log(`\nShipped weights (all fights): ${JSON.stringify(shipped.weights)}`);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify({ tunedAt: new Date().toISOString(), testFromDate, heldOut: report, windows, model: shipped }, null, 2) + '\n');
  console.log(`Wrote ${path.relative(process.cwd(), OUTPUT_FILE)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
