// data/lib/rating/normalize-weight-class.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWeightClass } from './normalize-weight-class';

test('normalizeWeightClass passes through an exact canonical match', () => {
  assert.equal(normalizeWeightClass('Lightweight'), 'Lightweight');
});

test('normalizeWeightClass passes through a Women\'s division exactly', () => {
  assert.equal(normalizeWeightClass("Women's Bantamweight"), "Women's Bantamweight");
});

test('normalizeWeightClass trims surrounding whitespace', () => {
  assert.equal(normalizeWeightClass('  Heavyweight  '), 'Heavyweight');
});

test('normalizeWeightClass returns null for a catchweight bout', () => {
  assert.equal(normalizeWeightClass('Catch Weight'), null);
});

test('normalizeWeightClass returns null for an unrecognized/historical division', () => {
  assert.equal(normalizeWeightClass('Open Weight'), null);
});

test('normalizeWeightClass returns null for a one-off tournament-bracket label', () => {
  assert.equal(normalizeWeightClass('Ultimate Fighter 14 Bantamweight Tournament'), null);
});

test('normalizeWeightClass strips an "Interim " prefix to the real division', () => {
  assert.equal(normalizeWeightClass('Interim Lightweight'), 'Lightweight');
});

test('normalizeWeightClass passes through Women\'s Featherweight despite it having no live ufc.com ranking table today', () => {
  assert.equal(normalizeWeightClass("Women's Featherweight"), "Women's Featherweight");
});

test('normalizeWeightClass returns null for an empty string', () => {
  assert.equal(normalizeWeightClass(''), null);
});
