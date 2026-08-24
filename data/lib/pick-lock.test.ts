// data/lib/pick-lock.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isEventLocked } from './pick-lock';

test('isEventLocked is false before start_time', () => {
  const locked = isEventLocked({ start_time: '2026-08-22T22:00:00Z', date: '2026-08-22' }, new Date('2026-08-22T21:59:59Z'));
  assert.equal(locked, false);
});

test('isEventLocked is true at exactly start_time', () => {
  const locked = isEventLocked({ start_time: '2026-08-22T22:00:00Z', date: '2026-08-22' }, new Date('2026-08-22T22:00:00Z'));
  assert.equal(locked, true);
});

test('isEventLocked is true after start_time', () => {
  const locked = isEventLocked({ start_time: '2026-08-22T22:00:00Z', date: '2026-08-22' }, new Date('2026-08-23T01:00:00Z'));
  assert.equal(locked, true);
});

test('isEventLocked falls back to 00:00 UTC on `date` when start_time is null', () => {
  const notYetLocked = isEventLocked({ start_time: null, date: '2026-08-22' }, new Date('2026-08-21T23:59:59Z'));
  const locked = isEventLocked({ start_time: null, date: '2026-08-22' }, new Date('2026-08-22T00:00:00Z'));
  assert.equal(notYetLocked, false);
  assert.equal(locked, true);
});
