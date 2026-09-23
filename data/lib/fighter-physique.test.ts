import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatPhysique } from './fighter-physique';

test('formatPhysique shows height in meters and reach in cm', () => {
  assert.equal(formatPhysique(193, 215), '1,93 m · Allonge 215 cm');
});

test('formatPhysique keeps the trailing zero on a round height', () => {
  assert.equal(formatPhysique(180, null), '1,80 m');
});

test('formatPhysique shows reach alone, or nothing at all', () => {
  assert.equal(formatPhysique(null, 188), 'Allonge 188 cm');
  assert.equal(formatPhysique(null, null), null);
});
