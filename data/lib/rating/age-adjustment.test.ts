import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adjustForAge, ageFeatures, fitAgeAdjustment, type AgeAdjustmentModel } from './age-adjustment';

const MODEL: AgeAdjustmentModel = { ratingWeight: 1, ageGapWeight: -0.25, veteranWeight: -0.25, veteranAge: 32 };

test('same age leaves the rating odds alone (ratingWeight 1)', () => {
  const p = adjustForAge(0.6, 28, 28, MODEL);
  assert.ok(Math.abs(p.winA - 0.6) < 1e-9);
  assert.ok(Math.abs(p.withoutAge - 0.6) < 1e-9);
  assert.equal(p.ageKnown, true);
});

test('the younger fighter gains, more so past the veteran age', () => {
  const young = adjustForAge(0.5, 26, 32, MODEL).winA;
  const vsVeteran = adjustForAge(0.5, 30, 36, MODEL).winA;
  assert.ok(young > 0.5);
  assert.ok(vsVeteran > young);
});

test('the result does not depend on which corner is A', () => {
  const ab = adjustForAge(0.65, 37, 29, MODEL).winA;
  const ba = adjustForAge(0.35, 29, 37, MODEL).winA;
  assert.ok(Math.abs(ab + ba - 1) < 1e-9);
});

test('an unknown age switches the age terms off', () => {
  const p = adjustForAge(0.7, null, 30, MODEL);
  assert.equal(p.ageKnown, false);
  assert.equal(p.winA, p.withoutAge);
  assert.deepEqual(ageFeatures(0.5, 30, null, 32), { logit: 0, ageGap: 0, veteran: 0 });
});

test('fitAgeAdjustment recovers a negative age weight when the younger fighter wins more', () => {
  const samples = [];
  for (let i = 0; i < 400; i++) {
    const gap = ((i % 9) - 4) * 2; // A older by -8..8 years
    const pYoungerWins = 0.5 - 0.04 * gap;
    const aWon = (i * 0.6180339) % 1 < pYoungerWins;
    samples.push({ features: ageFeatures(0.5, 30 + gap, 30, 40), aWon });
  }
  const model = fitAgeAdjustment(samples, 40);
  assert.ok(model.ageGapWeight < -0.2, `ageGapWeight ${model.ageGapWeight}`);
});
