// data/scripts/tune-fight-outcome.ts
//
// `npm run tune:outcome`: fits and validates the fight simulator's method and
// round model (data/lib/rating/fight-outcome.ts). Replays every UFC fight in
// date order, building each fighter's profile (UFC fights from UFCStats,
// other organizations from Sherdog) from fights strictly before it, then:
//   - priors (division method mix, 5-round factor, round shares) are counted
//     on training fights from PRIOR_FROM on (the early no-rules years end
//     differently),
//   - the constants are tuned by pattern search on training-fight log-loss,
//   - everything is reported on the most recent TEST_SHARE of fights, never
//     seen by either step, against the "division average" baseline.
// The shipped model is then refit on all fights and written to
// data/ml-models/fight-outcome-model.json. Read-only against Neon.
import fs from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';
import { loadEnvLocal } from './tuning-data';
import { normalizeWeightClass } from '../lib/rating/normalize-weight-class';
import { patternSearch, type ParamSearchSpace } from '../lib/rating/point-flow-tuning';
import {
  FINISH_METHODS,
  addFight,
  classifyMethod,
  combineProfiles,
  contextMix,
  emptyProfile,
  predictFinishRound,
  predictMethod,
  type FightOutcomeModel,
  type FightOutcomeParams,
  type FinishMethod,
  type MethodMix,
  type OutcomeProfile,
} from '../lib/rating/fight-outcome';

const OUTPUT_FILE = path.resolve('data/ml-models/fight-outcome-model.json');
const TEST_SHARE = 0.2;
const PRIOR_FROM = '2012-01-01';
const DIVISION_SHRINKAGE = 30; // pseudo-fights of the UFC-wide mix in each division's mix

const START: FightOutcomeParams = { shrinkage: 6, winnerWeight: 1, loserWeight: 1, crossWeight: 0.5, roundShrinkage: 6, roundTilt: 0.3, externalWeight: 0.5 };
const METHOD_SPACE: ParamSearchSpace<FightOutcomeParams> = {
  shrinkage: { min: 0.5, max: 60, kind: 'log', step: 2 },
  winnerWeight: { min: 0, max: 3, kind: 'linear', step: 0.4 },
  loserWeight: { min: 0, max: 3, kind: 'linear', step: 0.4 },
  crossWeight: { min: 0, max: 3, kind: 'linear', step: 0.4 },
  externalWeight: { min: 0, max: 1, kind: 'linear', step: 0.25 },
};
const ROUND_SPACE: ParamSearchSpace<FightOutcomeParams> = {
  roundShrinkage: { min: 0.5, max: 60, kind: 'log', step: 2 },
  roundTilt: { min: -1, max: 3, kind: 'linear', step: 0.4 },
};

type Side = { ufc: OutcomeProfile; external: OutcomeProfile };
type Sample = {
  date: string;
  division: string | null;
  scheduledRounds: 3 | 5;
  method: FinishMethod;
  finishRound: number | null;
  winner: Side;
  loser: Side;
};

const cloneProfile = (p: OutcomeProfile): OutcomeProfile => JSON.parse(JSON.stringify(p));

async function loadSamples(): Promise<Sample[]> {
  loadEnvLocal();
  const sql = neon(process.env.DATABASE_URL!);
  const ufcRows = (await sql.query(
    `SELECT fighter_id, ufcstats_fight_url AS url, event_date AS date, result, method, finish_round, scheduled_rounds, weight_class
     FROM fighter_fight_stats
     WHERE result IN ('win', 'loss') AND fighter_id IS NOT NULL AND event_date IS NOT NULL`,
  )) as { fighter_id: number; url: string; date: string; result: string; method: string | null; finish_round: number | null; scheduled_rounds: number | null; weight_class: string | null }[];
  // Sherdog also lists UFC fights; those come from UFCStats above instead.
  const externalRows = (await sql.query(
    `SELECT h.fighter_id, h.event_date AS date, h.result, h.method, h.round
     FROM fighter_fight_history h
     WHERE h.result IN ('win', 'loss') AND h.event_date IS NOT NULL AND h.event_name !~* '^UFC'
       AND h.fighter_id IN (SELECT DISTINCT fighter_id FROM fighter_fight_stats WHERE fighter_id IS NOT NULL)`,
  )) as { fighter_id: number; date: string; result: string; method: string | null; round: number | null }[];

  const byFight = new Map<string, typeof ufcRows>();
  for (const row of ufcRows) byFight.set(row.url, [...(byFight.get(row.url) ?? []), row]);
  const ufcFights = Array.from(byFight.values()).filter((pair) => pair.length === 2 && pair[0].result !== pair[1].result);

  type Event = { date: string; kind: 'ufc'; pair: typeof ufcRows } | { date: string; kind: 'ext'; row: (typeof externalRows)[number] };
  const events: Event[] = [
    ...ufcFights.map((pair) => ({ date: pair[0].date.slice(0, 10), kind: 'ufc' as const, pair })),
    ...externalRows.map((row) => ({ date: String(row.date).slice(0, 10), kind: 'ext' as const, row })),
  ].sort((x, y) => x.date.localeCompare(y.date));

  const profiles = new Map<number, Side>();
  const side = (id: number) => {
    if (!profiles.has(id)) profiles.set(id, { ufc: emptyProfile(), external: emptyProfile() });
    return profiles.get(id)!;
  };

  const samples: Sample[] = [];
  let pending: (() => void)[] = []; // same-day results are added only once the whole day is predicted
  let currentDate = '';
  for (const event of events) {
    if (event.date !== currentDate) {
      pending.forEach((apply) => apply());
      pending = [];
      currentDate = event.date;
    }
    if (event.kind === 'ext') {
      const method = classifyMethod(event.row.method);
      if (!method) continue;
      const { fighter_id, result, round } = event.row;
      pending.push(() => addFight(side(fighter_id).external, result === 'win', method, round));
      continue;
    }
    const [winnerRow, loserRow] = event.pair[0].result === 'win' ? event.pair : [event.pair[1], event.pair[0]];
    const method = classifyMethod(winnerRow.method);
    if (!method) continue;
    const winner = side(winnerRow.fighter_id);
    const loser = side(loserRow.fighter_id);
    samples.push({
      date: event.date,
      division: winnerRow.weight_class ? normalizeWeightClass(winnerRow.weight_class) : null,
      scheduledRounds: winnerRow.scheduled_rounds === 5 ? 5 : 3,
      method,
      finishRound: winnerRow.finish_round,
      winner: { ufc: cloneProfile(winner.ufc), external: cloneProfile(winner.external) },
      loser: { ufc: cloneProfile(loser.ufc), external: cloneProfile(loser.external) },
    });
    pending.push(() => {
      addFight(winner.ufc, true, method, winnerRow.finish_round);
      addFight(loser.ufc, false, method, winnerRow.finish_round);
    });
  }
  return samples;
}

// Counts the priors (mixes, 5-round factor, round shares) on `samples`.
function fitPriors(samples: Sample[], params: FightOutcomeParams): FightOutcomeModel {
  const count = (filter: (s: Sample) => boolean): MethodMix => {
    const tally: MethodMix = { ko: 0, sub: 0, dec: 0 };
    for (const s of samples) if (filter(s)) tally[s.method]++;
    return tally;
  };
  const share = (tally: MethodMix): MethodMix => {
    const total = tally.ko + tally.sub + tally.dec;
    return { ko: tally.ko / total, sub: tally.sub / total, dec: tally.dec / total };
  };
  const globalMix = share(count((s) => s.scheduledRounds === 3));
  const divisionMix: Record<string, MethodMix> = {};
  for (const division of Array.from(new Set(samples.map((s) => s.division).filter((d): d is string => !!d)))) {
    const tally = count((s) => s.scheduledRounds === 3 && s.division === division);
    divisionMix[division] = share({
      ko: tally.ko + DIVISION_SHRINKAGE * globalMix.ko,
      sub: tally.sub + DIVISION_SHRINKAGE * globalMix.sub,
      dec: tally.dec + DIVISION_SHRINKAGE * globalMix.dec,
    });
  }
  const five = share(count((s) => s.scheduledRounds === 5));
  const fiveRoundFactor: MethodMix = { ko: five.ko / globalMix.ko, sub: five.sub / globalMix.sub, dec: five.dec / globalMix.dec };

  const roundShares = { '3': { ko: [] as number[], sub: [] as number[] }, '5': { ko: [] as number[], sub: [] as number[] } };
  let finishCount = 0;
  let finishRoundSum = 0;
  for (const rounds of [3, 5] as const) {
    for (const method of ['ko', 'sub'] as const) {
      const counts = Array.from({ length: rounds }, () => 1); // +1 smoothing per round
      for (const s of samples) {
        if (s.scheduledRounds !== rounds || s.method !== method || !s.finishRound || s.finishRound > rounds) continue;
        counts[s.finishRound - 1]++;
        finishCount++;
        finishRoundSum += s.finishRound;
      }
      const total = counts.reduce((a, b) => a + b, 0);
      roundShares[rounds][method] = counts.map((c) => c / total);
    }
  }
  return { params, globalMix, divisionMix, fiveRoundFactor, roundShares, meanFinishRound: finishRoundSum / finishCount };
}

const profileOf = (side: Side, w: number) => combineProfiles(side.ufc, side.external, w);

function methodLogLoss(samples: Sample[], model: FightOutcomeModel, mode: 'global' | 'division' | 'model'): number {
  let total = 0;
  for (const s of samples) {
    let p: MethodMix;
    if (mode === 'global') p = contextMix(model, [null], 3);
    else {
      const prior = contextMix(model, [s.division], s.scheduledRounds);
      p = mode === 'division' ? prior : predictMethod(profileOf(s.winner, model.params.externalWeight), profileOf(s.loser, model.params.externalWeight), prior, model.params);
    }
    total -= Math.log(p[s.method]);
  }
  return total / samples.length;
}

const isRoundSample = (s: Sample) => s.method !== 'dec' && !!s.finishRound && s.finishRound <= s.scheduledRounds;

function roundLogLoss(samples: Sample[], model: FightOutcomeModel, useFighters: boolean): number {
  const usable = samples.filter(isRoundSample);
  let total = 0;
  for (const s of usable) {
    const method = s.method as 'ko' | 'sub';
    const p = useFighters
      ? predictFinishRound(profileOf(s.winner, model.params.externalWeight), profileOf(s.loser, model.params.externalWeight), method, s.scheduledRounds, model)
      : model.roundShares[String(s.scheduledRounds) as '3' | '5'][method];
    total -= Math.log(p[s.finishRound! - 1]);
  }
  return total / usable.length;
}

// Top-1 accuracy of the method pick, and how well-calibrated the predicted shares are.
function methodAccuracy(samples: Sample[], model: FightOutcomeModel): number {
  let hits = 0;
  for (const s of samples) {
    const p = predictMethod(profileOf(s.winner, model.params.externalWeight), profileOf(s.loser, model.params.externalWeight), contextMix(model, [s.division], s.scheduledRounds), model.params);
    const best = FINISH_METHODS.reduce((a, b) => (p[b] > p[a] ? b : a));
    if (best === s.method) hits++;
  }
  return hits / samples.length;
}

function calibration(samples: Sample[], model: FightOutcomeModel) {
  const buckets = Array.from({ length: 5 }, () => ({ predicted: 0, observed: 0, n: 0 }));
  for (const s of samples) {
    const p = predictMethod(profileOf(s.winner, model.params.externalWeight), profileOf(s.loser, model.params.externalWeight), contextMix(model, [s.division], s.scheduledRounds), model.params);
    for (const m of FINISH_METHODS) {
      const bucket = buckets[Math.min(4, Math.floor(p[m] * 5))];
      bucket.predicted += p[m];
      bucket.observed += s.method === m ? 1 : 0;
      bucket.n++;
    }
  }
  return buckets.map((b, i) => `${i * 20}-${i * 20 + 20}%: predicted ${((b.predicted / b.n) * 100).toFixed(1)}%, observed ${((b.observed / b.n) * 100).toFixed(1)}% (n=${b.n})`);
}

async function main() {
  const samples = await loadSamples();
  const dates = samples.map((s) => s.date).sort();
  const testFromDate = dates[Math.floor(dates.length * (1 - TEST_SHARE))];
  const train = samples.filter((s) => s.date >= PRIOR_FROM && s.date < testFromDate);
  const test = samples.filter((s) => s.date >= testFromDate);
  console.log(`${samples.length} decided UFC fights. Training on ${PRIOR_FROM}..${testFromDate} (${train.length}), testing from ${testFromDate} (${test.length}).\n`);

  const withParams = (params: FightOutcomeParams) => ({ ...fitPriors(train, params), params });
  const methodSearch = patternSearch((p) => methodLogLoss(train, withParams(p), 'model'), START, METHOD_SPACE, {
    onImprove: (key, value, objective) => console.log(`  method ${String(key)} = ${value.toFixed(3)} -> ${objective.toFixed(4)}`),
  });
  const roundSearch = patternSearch((p) => roundLogLoss(train, withParams(p), true), methodSearch.params, ROUND_SPACE, {
    onImprove: (key, value, objective) => console.log(`  round ${String(key)} = ${value.toFixed(3)} -> ${objective.toFixed(4)}`),
  });
  const params = roundSearch.params;
  const trained = withParams(params);

  const report = {
    method: {
      global: methodLogLoss(test, trained, 'global'),
      division: methodLogLoss(test, trained, 'division'),
      model: methodLogLoss(test, trained, 'model'),
      accuracy: methodAccuracy(test, trained),
      count: test.length,
    },
    round: { base: roundLogLoss(test, trained, false), model: roundLogLoss(test, trained, true), count: test.filter(isRoundSample).length },
  };
  console.log('\nTuned params:', params);
  console.log(`\nHeld-out method log-loss (P(method | winner), ${report.method.count} fights):`);
  console.log(`  UFC-wide mix        ${report.method.global.toFixed(4)}`);
  console.log(`  division + 5 rounds ${report.method.division.toFixed(4)}`);
  console.log(`  + fighter profiles  ${report.method.model.toFixed(4)}   (top pick right ${(report.method.accuracy * 100).toFixed(1)}%)`);
  console.log(`Held-out round log-loss (P(round | finish), ${report.round.count} finishes):`);
  console.log(`  UFC-wide shares     ${report.round.base.toFixed(4)}`);
  console.log(`  + fighter profiles  ${report.round.model.toFixed(4)}`);
  console.log('\nCalibration (held-out):');
  for (const line of calibration(test, trained)) console.log('  ' + line);

  // Ship priors counted on every fight since PRIOR_FROM, with the tuned constants.
  const shipped = fitPriors(samples.filter((s) => s.date >= PRIOR_FROM), params);
  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify({ tunedAt: new Date().toISOString(), testFromDate, heldOut: report, model: shipped }, null, 2) + '\n',
  );
  console.log(`\nWrote ${path.relative(process.cwd(), OUTPUT_FILE)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
