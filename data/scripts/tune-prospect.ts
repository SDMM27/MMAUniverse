// data/scripts/tune-prospect.ts
//
// `npm run tune:prospect`: does starting UFC debutants from their pre-UFC
// record (data/lib/rating/prospect-rating.ts) make the fight simulator
// better? Every fighter used to start the Glicko at 1500. Here a debutant
// starts at 1500 + scale * (pre-UFC Elo - 1500), the Elo replayed over every
// non-UFC bout of the Sherdog histories.
//
// For each Elo K and scale on a grid: replay every UFC career with those
// starting ratings, refit the matchup layer on the training fights, score the
// simulator's odds. K and scale are picked on training log-loss only:
//   - once on the fights before the most recent 20% (reported on the rest,
//     overall and on debut fights, where the gain should show),
//   - again before each of the four windows of tune-matchup, so no window
//     ever helps pick the settings it is judged on.
// scale 0 is today's rating. Writes the settings picked on every fight to
// data/ml-models/prospect-params.json; nothing reads it yet: wiring the prior
// into compute-fighter-ratings (and so the ranking) is a separate, reviewed
// step. Read-only against Neon.
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_GLICKO_PARAMS } from '../lib/rating/glicko-rating';
import { simulateCareerRatings } from '../lib/rating/simulate-career';
import { collectExternalBouts, prospectInitialRating, simulateProspectElo, type ProspectElo } from '../lib/rating/prospect-rating';
import { MATCHUP_MODEL } from '../lib/rating/matchup-model-tuned';
import { WINDOWS, attachRatings, fit, line, loadExternalHistory, loadMatchupData, metrics, testFromDateOf, withModel, type Metrics, type Sample } from './matchup-tuning';

const OUTPUT_FILE = path.resolve('data/ml-models/prospect-params.json');
const K_VALUES = [32, 48, 64, 96];
const SCALES = [0, 0.4, 0.8, 1, 1.2, 1.4, 1.6, 2];

type Setting = { k: number; scale: number };

async function main() {
  const data = await loadMatchupData();
  const { rows, sherdogUrlOf } = await loadExternalHistory();
  const bouts = collectExternalBouts(rows);
  const { veteranAge } = MATCHUP_MODEL;
  const lookups = new Map(K_VALUES.map((k) => [k, simulateProspectElo(bouts, k)]));

  // Coverage: how many UFC debuts the prior knows something about.
  const debuts = new Map<number, string>();
  for (const f of data.fights) for (const id of [f.winnerId, f.loserId]) if (!debuts.has(id)) debuts.set(id, f.eventDate);
  const known = Array.from(debuts).filter(([id, date]) => sherdogUrlOf.has(id) && lookups.get(K_VALUES[0])!(sherdogUrlOf.get(id)!, date).bouts > 0).length;
  console.log(`${bouts.length} non-UFC bouts from ${rows.length} Sherdog history rows. Pre-UFC bouts known for ${known} of ${debuts.size} UFC debutants (${((known / debuts.size) * 100).toFixed(0)}%).`);

  const cache = new Map<string, Sample[]>();
  const samplesFor = ({ k, scale }: Setting): Sample[] => {
    const key = scale === 0 ? 'none' : `${k}|${scale}`;
    if (!cache.has(key)) {
      const lookup = lookups.get(k)!;
      const initialRatingOf = (id: number, date: string) => {
        const url = sherdogUrlOf.get(id);
        const elo: ProspectElo | null = url ? lookup(url, date) : null;
        return elo ? prospectInitialRating(elo, scale, DEFAULT_GLICKO_PARAMS.initialRating) : DEFAULT_GLICKO_PARAMS.initialRating;
      };
      cache.set(key, attachRatings(data.contexts, simulateCareerRatings(data.fights, data.noResults, DEFAULT_GLICKO_PARAMS, initialRatingOf).history));
    }
    return cache.get(key)!;
  };
  const settings: Setting[] = K_VALUES.flatMap((k) => SCALES.filter((s) => s > 0).map((scale) => ({ k, scale })));
  const baseline: Setting = { k: K_VALUES[0], scale: 0 };

  /** The setting with the lowest training log-loss (layer refit on the same fights) among fights before `before`. */
  const pick = (before: string): Setting => {
    let best = { setting: baseline, logLoss: Infinity };
    for (const setting of [baseline, ...settings]) {
      const train = samplesFor(setting).filter((s) => s.date < before);
      const { logLoss } = metrics(train, withModel(fit(train, veteranAge)));
      if (logLoss < best.logLoss) best = { setting, logLoss };
    }
    return best.setting;
  };
  const judge = (setting: Setting, from: string, to: string) => {
    const samples = samplesFor(setting);
    const model = fit(samples.filter((s) => s.date < from), veteranAge);
    const inside = samples.filter((s) => s.date >= from && s.date < to);
    return {
      simulator: metrics(inside, withModel(model)),
      debuts: metrics(inside.filter((s) => s.debut), withModel(model)),
      glickoAlone: metrics(inside, (s) => s.ratingWinA),
      count: inside.length,
      debutCount: inside.filter((s) => s.debut).length,
      ratingWeight: model.weights.rating,
    };
  };

  const testFromDate = testFromDateOf(data.contexts);
  console.log(`\nTraining log-loss per setting (fights before ${testFromDate}):`);
  for (const k of K_VALUES) {
    const values = SCALES.map((scale) => {
      const train = samplesFor({ k, scale }).filter((s) => s.date < testFromDate);
      return `${scale}: ${metrics(train, withModel(fit(train, veteranAge))).logLoss.toFixed(4)}`;
    });
    console.log(`  K ${String(k).padEnd(3)} ${values.join('  ')}`);
  }
  const picked = pick(testFromDate);
  console.log(`\nPicked on training fights: K ${picked.k}, scale ${picked.scale}.`);

  const before = judge(baseline, testFromDate, '9999-12-31');
  const after = judge(picked, testFromDate, '9999-12-31');
  const pair = (label: string, a: Metrics, b: Metrics) => {
    line(`${label}, today`, a);
    line(`${label}, with prior`, b);
  };
  console.log(`\nHeld-out (${before.count} fights from ${testFromDate}, ${before.debutCount} with a debutant):`);
  pair('simulator', before.simulator, after.simulator);
  pair('simulator, debut fights', before.debuts, after.debuts);
  pair('Glicko alone', before.glickoAlone, after.glickoAlone);
  console.log(`  rating weight in the layer: ${before.ratingWeight.toFixed(3)} -> ${after.ratingWeight.toFixed(3)}`);

  console.log('\nPicked again before each window, judged inside it (simulator log-loss, today -> with prior; debut fights):');
  const windows = WINDOWS.map(([from, to]) => {
    const setting = pick(from);
    const a = judge(baseline, from, to);
    const b = judge(setting, from, to);
    console.log(
      `  ${from} -> ${(to.slice(0, 4) === '9999' ? 'today' : to).padEnd(10)} (${a.count}, ${a.debutCount} debut)  K ${setting.k}, scale ${String(setting.scale).padEnd(4)} ` +
        `${a.simulator.logLoss.toFixed(4)} -> ${b.simulator.logLoss.toFixed(4)}   debut ${a.debuts.logLoss.toFixed(4)} -> ${b.debuts.logLoss.toFixed(4)}`,
    );
    return { from, to, setting, count: a.count, debutCount: a.debutCount, today: a.simulator, withPrior: b.simulator, debutsToday: a.debuts, debutsWithPrior: b.debuts };
  });
  const total = windows.reduce((n, w) => n + w.count, 0);
  const gain = windows.reduce((sum, w) => sum + (w.today.logLoss - w.withPrior.logLoss) * w.count, 0) / total;
  console.log(`  fight-weighted gain: ${gain >= 0 ? '+' : ''}${gain.toFixed(4)} (positive = the prior helps); better in ${windows.filter((w) => w.withPrior.logLoss < w.today.logLoss).length} of 4 windows`);

  const shipped = pick('9999-12-31');
  console.log(`\nPicked on every fight: K ${shipped.k}, scale ${shipped.scale}.`);
  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify({ tunedAt: new Date().toISOString(), testFromDate, heldOut: { picked, today: before, withPrior: after }, windows, shipped }, null, 2) + '\n',
  );
  console.log(`Wrote ${path.relative(process.cwd(), OUTPUT_FILE)}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
