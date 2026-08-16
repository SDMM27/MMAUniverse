import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDate } from './normalize-date';

test('normalizeDate extracts YYYY-MM-DD from a Sherdog ISO datetime', () => {
  assert.equal(normalizeDate('2013-09-20T00:00:00+00:00'), '2013-09-20');
});

test('normalizeDate handles a different date', () => {
  assert.equal(normalizeDate('2026-08-22T00:00:00+00:00'), '2026-08-22');
});

test('normalizeDate trims surrounding whitespace before parsing', () => {
  assert.equal(normalizeDate('  2024-01-05T00:00:00+00:00  '), '2024-01-05');
});

test('normalizeDate throws on an unrecognized format', () => {
  assert.throws(() => normalizeDate('not a date'), /Unrecognized Sherdog date format/);
});

test('normalizeDate throws on an empty string', () => {
  assert.throws(() => normalizeDate(''), /Unrecognized Sherdog date format/);
});
