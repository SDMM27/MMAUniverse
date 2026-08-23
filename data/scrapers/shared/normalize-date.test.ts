import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDate, normalizeStartTime } from './normalize-date';

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

test('normalizeStartTime passes through a valid Sherdog ISO datetime', () => {
  assert.equal(normalizeStartTime('2013-09-20T00:00:00+00:00'), '2013-09-20T00:00:00+00:00');
});

test('normalizeStartTime trims surrounding whitespace', () => {
  assert.equal(normalizeStartTime('  2026-08-22T22:00:00-04:00  '), '2026-08-22T22:00:00-04:00');
});

test('normalizeStartTime throws on an unrecognized format', () => {
  assert.throws(() => normalizeStartTime('not a date'), /Unrecognized Sherdog start time format/);
});

test('normalizeStartTime throws on an empty string', () => {
  assert.throws(() => normalizeStartTime(''), /Unrecognized Sherdog start time format/);
});

test('normalizeStartTime throws on a date without a time component', () => {
  assert.throws(() => normalizeStartTime('2026-08-22'), /Unrecognized Sherdog start time format/);
});

test('normalizeStartTime throws on a space-separated (non-ISO) datetime', () => {
  assert.throws(() => normalizeStartTime('2026-08-22 00:00:00'), /Unrecognized Sherdog start time format/);
});
