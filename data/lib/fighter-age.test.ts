import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ageFromBirthDate } from './fighter-age';

const today = new Date(2026, 8, 23); // Sep 23, 2026, local time

test('ageFromBirthDate counts a birthday already passed this year', () => {
  assert.equal(ageFromBirthDate('1987-07-19', today), 39);
});

test('ageFromBirthDate does not count a birthday still to come', () => {
  assert.equal(ageFromBirthDate('1996-12-13', today), 29);
});

test('ageFromBirthDate ticks over on the birthday itself', () => {
  assert.equal(ageFromBirthDate('1990-09-23', today), 36);
  assert.equal(ageFromBirthDate('1990-09-24', today), 35);
});

test('ageFromBirthDate reads a Date the way the DB driver builds it (local midnight)', () => {
  assert.equal(ageFromBirthDate(new Date(1990, 8, 23), today), 36);
});

test('ageFromBirthDate returns null for a missing or junk date', () => {
  assert.equal(ageFromBirthDate(null, today), null);
  assert.equal(ageFromBirthDate('N/A', today), null);
});
