import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSimulatorPath, matchSimulatorFighter, parseSimulatorParams } from './simulator-params';

const fighters = [
  { fighter_id: 1, fighter_name: 'Alex Pereira', weight_class: 'Light Heavyweight' },
  { fighter_id: 2, fighter_name: 'Jiri Prochazka', weight_class: 'Light Heavyweight' },
  { fighter_id: 3, fighter_name: 'Valentina Shevchenko', weight_class: "Women's Flyweight" },
];

test('parseSimulatorParams keeps two valid same-gender ids', () => {
  assert.deepEqual(parseSimulatorParams({ a: '1', b: '2' }, fighters), { a: 1, b: 2 });
});

test('parseSimulatorParams ignores unknown and malformed ids', () => {
  assert.deepEqual(parseSimulatorParams({ a: '999', b: 'abc' }, fighters), { a: null, b: null });
  assert.deepEqual(parseSimulatorParams({ a: '1', b: '2x' }, fighters), { a: 1, b: null });
  assert.deepEqual(parseSimulatorParams({ a: '-1', b: '1.5' }, fighters), { a: null, b: null });
  assert.deepEqual(parseSimulatorParams({}, fighters), { a: null, b: null });
});

test('parseSimulatorParams keeps a valid b when a is invalid', () => {
  assert.deepEqual(parseSimulatorParams({ a: '999', b: '2' }, fighters), { a: null, b: 2 });
});

test('parseSimulatorParams drops b when it repeats a', () => {
  assert.deepEqual(parseSimulatorParams({ a: '1', b: '1' }, fighters), { a: 1, b: null });
});

test('parseSimulatorParams drops b on a men/women mix', () => {
  assert.deepEqual(parseSimulatorParams({ a: '1', b: '3' }, fighters), { a: 1, b: null });
});

test('parseSimulatorParams takes the first value of a repeated param', () => {
  assert.deepEqual(parseSimulatorParams({ a: ['2', '1'], b: '1' }, fighters), { a: 2, b: 1 });
});

test('buildSimulatorPath only emits set corners', () => {
  assert.equal(buildSimulatorPath({ a: 1, b: 2 }), '/simulateur?a=1&b=2');
  assert.equal(buildSimulatorPath({ a: null, b: 2 }), '/simulateur?b=2');
  assert.equal(buildSimulatorPath({ a: null, b: null }), '/simulateur');
});

test('matchSimulatorFighter matches by id, then by unique name', () => {
  assert.equal(matchSimulatorFighter(fighters, { id: 2, name: 'Whoever' })?.fighter_id, 2);
  assert.equal(matchSimulatorFighter(fighters, { id: 77, name: 'alex  pereira' })?.fighter_id, 1);
  assert.equal(matchSimulatorFighter(fighters, { id: 77, name: 'Nobody' }), null);
  assert.equal(matchSimulatorFighter(fighters, null), null);
});
