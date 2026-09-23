import { test } from 'node:test';
import assert from 'node:assert/strict';
import { liveEventDates, isRecentPastDate } from './live-dates';

test('liveEventDates keeps yesterday live overnight (an American card past 00:00 UTC)', () => {
  assert.deepEqual(liveEventDates(new Date('2026-09-20T04:30:00Z')), ['2026-09-20', '2026-09-19']);
});

test('liveEventDates drops yesterday from noon UTC on', () => {
  assert.deepEqual(liveEventDates(new Date('2026-09-20T12:00:00Z')), ['2026-09-20']);
  assert.deepEqual(liveEventDates(new Date('2026-09-19T23:00:00Z')), ['2026-09-19']);
});

test('isRecentPastDate covers the last 30 days, excluding today and the future', () => {
  const now = new Date('2026-09-23T09:00:00Z');
  assert.equal(isRecentPastDate('2026-09-19', now), true);
  assert.equal(isRecentPastDate('2026-08-24', now), true);
  assert.equal(isRecentPastDate('2026-08-22', now), false);
  assert.equal(isRecentPastDate('2026-09-23', now), false);
  assert.equal(isRecentPastDate('2026-09-26', now), false);
});
