import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addFight,
  classifyMethod,
  combineProfiles,
  contextMix,
  emptyProfile,
  predictFinishRound,
  predictMethod,
  predictOutcomes,
  type FightOutcomeModel,
} from './fight-outcome';

const model: FightOutcomeModel = {
  params: { shrinkage: 2, winnerWeight: 0.5, loserWeight: 0.35, crossWeight: 0, roundShrinkage: 1, roundTilt: 0.4, externalWeight: 0.2 },
  globalMix: { ko: 0.3, sub: 0.2, dec: 0.5 },
  divisionMix: { Heavyweight: { ko: 0.5, sub: 0.15, dec: 0.35 } },
  fiveRoundFactor: { ko: 1.2, sub: 0.8, dec: 0.95 },
  roundShares: { '3': { ko: [0.5, 0.3, 0.2], sub: [0.55, 0.3, 0.15] }, '5': { ko: [0.35, 0.25, 0.2, 0.12, 0.08], sub: [0.4, 0.3, 0.15, 0.1, 0.05] } },
  meanFinishRound: 1.7,
};

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

test('classifyMethod reads both UFCStats and Sherdog spellings', () => {
  assert.equal(classifyMethod('KO/TKO'), 'ko');
  assert.equal(classifyMethod("TKO - Doctor's Stoppage"), 'ko');
  assert.equal(classifyMethod('TKO (Punches)'), 'ko');
  assert.equal(classifyMethod('KO (Head Kick)'), 'ko');
  assert.equal(classifyMethod('Submission'), 'sub');
  assert.equal(classifyMethod('Technical Submission (Arm-Triangle Choke)'), 'sub');
  assert.equal(classifyMethod('Decision - Split'), 'dec');
  assert.equal(classifyMethod('Decision (Unanimous)'), 'dec');
  assert.equal(classifyMethod('Technical Decision (Majority)'), 'dec');
  for (const other of ['DQ', 'Overturned', 'Could Not Continue', 'No Contest', 'Draw', '', null]) assert.equal(classifyMethod(other), null);
});

test('an empty record gives back the context mix', () => {
  const prior = contextMix(model, ['Heavyweight'], 3);
  const p = predictMethod(emptyProfile(), emptyProfile(), prior, model.params);
  for (const m of ['ko', 'sub', 'dec'] as const) assert.ok(Math.abs(p[m] - prior[m]) < 1e-12);
});

test('context mix: unknown division falls back to UFC-wide, 5 rounds reweights and stays normalized', () => {
  assert.deepEqual(contextMix(model, ['Catch Weight'], 3), model.globalMix);
  const five = contextMix(model, [null], 5);
  assert.ok(Math.abs(five.ko + five.sub + five.dec - 1) < 1e-12);
  assert.ok(five.ko > model.globalMix.ko);
  const mixed = contextMix(model, ['Heavyweight', null], 3);
  assert.ok(Math.abs(mixed.ko - 0.4) < 1e-12);
});

test('a knockout artist facing a fighter who gets knocked out leans KO', () => {
  const striker = emptyProfile();
  for (let i = 0; i < 8; i++) addFight(striker, true, 'ko', 1);
  const chin = emptyProfile();
  for (let i = 0; i < 4; i++) addFight(chin, false, 'ko', 2);
  const p = predictMethod(striker, chin, model.globalMix, model.params);
  assert.ok(p.ko > model.globalMix.ko + 0.15);
  assert.ok(Math.abs(p.ko + p.sub + p.dec - 1) < 1e-12);
});

test('finish rounds tilt earlier for fighters who finish early', () => {
  const early = emptyProfile();
  for (let i = 0; i < 6; i++) addFight(early, true, 'ko', 1);
  const late = emptyProfile();
  for (let i = 0; i < 6; i++) addFight(late, true, 'ko', 3);
  const base = predictFinishRound(emptyProfile(), emptyProfile(), 'ko', 3, model);
  const fast = predictFinishRound(early, emptyProfile(), 'ko', 3, model);
  const slow = predictFinishRound(late, emptyProfile(), 'ko', 3, model);
  assert.ok(fast[0] > base[0] && slow[0] < base[0]);
  assert.ok(Math.abs(sum(fast) - 1) < 1e-12);
  assert.equal(predictFinishRound(early, early, 'sub', 5, model).length, 5);
});

test('external fights count at the given weight', () => {
  const ufc = emptyProfile();
  addFight(ufc, true, 'sub', 1);
  const ext = emptyProfile();
  addFight(ext, true, 'sub', 2);
  addFight(ext, false, 'dec', 3);
  const combined = combineProfiles(ufc, ext, 0.25);
  assert.equal(combined.wins.sub, 1.25);
  assert.equal(combined.losses.dec, 0.25);
  assert.equal(combined.finishWins.count, 1.25);
  assert.equal(combined.finishWins.roundSum, 1.5);
  assert.equal(combined.finishLosses.count, 0); // decisions have no finish round
});

test('the six outcomes add up to 1 and each corner to its win odds', () => {
  const a = emptyProfile();
  addFight(a, true, 'ko', 1);
  const b = emptyProfile();
  addFight(b, true, 'sub', 2);
  const lines = predictOutcomes(0.7, a, b, model.globalMix, 3, model);
  assert.equal(lines.length, 6);
  assert.ok(Math.abs(sum(lines.map((l) => l.probability)) - 1) < 1e-12);
  assert.ok(Math.abs(sum(lines.filter((l) => l.corner === 'A').map((l) => l.probability)) - 0.7) < 1e-12);
  for (const line of lines) {
    if (line.method === 'dec') assert.equal(line.byRound.length, 0);
    else assert.ok(Math.abs(sum(line.byRound) - line.probability) < 1e-12);
  }
});
