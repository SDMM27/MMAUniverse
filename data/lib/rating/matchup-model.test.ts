import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MATCHUP_TERMS,
  addFightToProfile,
  emptyMatchupProfile,
  fightMinutes,
  fitMatchupWeights,
  matchupFeatures,
  predictMatchup,
  profileRates,
  type MatchupModel,
  type MatchupProfile,
} from './matchup-model';

const MODEL: MatchupModel = {
  weights: { rating: 1, age: -0.2, veteran: -0.25, strikes: 0.2, control: 0.2, knockdowns: -0.15, layoff: -0.25, reach: 0.1 },
  veteranAge: 31,
  longLayoffMonths: 15,
  priorMinutes: 30,
};
const fighter = (over: Partial<MatchupProfile> = {}): MatchupProfile => ({ ...emptyMatchupProfile(), age: 30, reachCm: 180, monthsSinceLastFight: 6, ...over });

test('two identical fighters keep the rating odds (rating weight 1)', () => {
  const p = predictMatchup(0.6, fighter(), fighter(), MODEL);
  assert.ok(Math.abs(p.winA - 0.6) < 1e-9);
  for (const shift of Object.values(p.shifts)) assert.ok(Math.abs(shift) < 1e-12);
});

test('the result does not depend on which corner is A', () => {
  const a = fighter({ age: 37, reachCm: 190, monthsSinceLastFight: 20, ufcMinutes: 120, sigStrikesLanded: 600, sigStrikesAbsorbed: 400 });
  const b = fighter({ age: 28, ufcMinutes: 40, sigStrikesLanded: 100, sigStrikesAbsorbed: 150, knockdownsAbsorbed: 2 });
  const ab = predictMatchup(0.62, a, b, MODEL).winA;
  const ba = predictMatchup(0.38, b, a, MODEL).winA;
  assert.ok(Math.abs(ab + ba - 1) < 1e-9);
});

test('each factor pushes the expected way', () => {
  const base = predictMatchup(0.5, fighter(), fighter(), MODEL).winA;
  assert.ok(predictMatchup(0.5, fighter({ age: 26 }), fighter({ age: 36 }), MODEL).shifts.age > 0);
  assert.ok(predictMatchup(0.5, fighter({ ufcMinutes: 100, sigStrikesLanded: 500, sigStrikesAbsorbed: 300 }), fighter(), MODEL).winA > base);
  assert.ok(predictMatchup(0.5, fighter({ monthsSinceLastFight: 24 }), fighter(), MODEL).shifts.layoff < 0);
  assert.ok(predictMatchup(0.5, fighter({ ufcMinutes: 60, knockdownsAbsorbed: 3 }), fighter({ ufcMinutes: 60 }), MODEL).shifts.knockdowns < 0);
  assert.ok(predictMatchup(0.5, fighter({ reachCm: 195 }), fighter(), MODEL).shifts.reach > 0);
});

test('unknown age or reach switch their terms off', () => {
  const x = matchupFeatures(0.5, fighter({ age: null, reachCm: null }), fighter({ age: 40 }), MODEL);
  assert.equal(x.age, 0);
  assert.equal(x.veteran, 0);
  assert.equal(x.reach, 0);
});

test('a debutant reads as the UFC average', () => {
  const rates = profileRates(emptyMatchupProfile(), 30);
  assert.equal(rates.strikeDiffPerMin, 0);
  assert.equal(rates.controlShare, 0.5);
  assert.ok(Math.abs(rates.knockdownsAbsorbedPer15 - 0.25) < 1e-12);
});

test('fightMinutes reads the finish round and time', () => {
  assert.equal(fightMinutes(3, '5:00'), 15);
  assert.equal(fightMinutes(1, '1:30'), 1.5);
  assert.equal(fightMinutes(null, null), 15);
});

test('addFightToProfile sums the fight in', () => {
  const p = addFightToProfile(emptyMatchupProfile(), { minutes: 15, sigStrikesLanded: 60, sigStrikesAbsorbed: 40, controlSeconds: 120, controlledSeconds: 30, knockdownsAbsorbed: 1 });
  assert.equal(p.ufcMinutes, 15);
  assert.equal(p.sigStrikesAbsorbed, 40);
  assert.equal(p.knockdownsAbsorbed, 1);
});

test('fitMatchupWeights recovers the sign of a real effect and leaves unused terms at 0', () => {
  const samples = [];
  for (let i = 0; i < 600; i++) {
    const reach = ((i % 7) - 3) / 2;
    const aWon = (i * 0.6180339) % 1 < 0.5 + 0.12 * reach;
    const x = Object.fromEntries(MATCHUP_TERMS.map((t) => [t, 0])) as Record<(typeof MATCHUP_TERMS)[number], number>;
    x.reach = reach;
    samples.push({ x, aWon });
  }
  const w = fitMatchupWeights(samples, ['rating', 'reach']);
  assert.ok(w.reach > 0.2, `reach ${w.reach}`);
  assert.equal(w.age, 0);
});
