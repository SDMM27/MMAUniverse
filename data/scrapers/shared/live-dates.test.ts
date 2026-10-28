import { test } from 'node:test';
import assert from 'node:assert/strict';
import { liveEventDates, isRecentPastDate, isMissedPastDate, catchUpDaysFromArgs } from './live-dates';

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

test('a wider catch-up window reaches older incomplete events', () => {
  const now = new Date('2026-10-28T10:00:00Z');
  assert.equal(isRecentPastDate('2026-08-22', now), false);
  assert.equal(isRecentPastDate('2026-08-22', now, 75), true);
});

test('isMissedPastDate flags an incomplete event just past the window, not a years-old one', () => {
  const now = new Date('2026-10-28T10:00:00Z');
  assert.equal(isMissedPastDate('2026-08-22', now), true);
  assert.equal(isMissedPastDate('2026-10-20', now), false); // still inside the 30 days
  assert.equal(isMissedPastDate('2018-09-22', now), false); // older than a year: known, permanent gap
  assert.equal(isMissedPastDate('2026-08-22', now, 75), false);
});

test('catchUpDaysFromArgs defaults to 30 and rejects nonsense', () => {
  assert.equal(catchUpDaysFromArgs(['node', 'x.ts']), 30);
  assert.equal(catchUpDaysFromArgs(['node', 'x.ts', 'ufc', '--catch-up-days=75']), 75);
  assert.throws(() => catchUpDaysFromArgs(['node', 'x.ts', '--catch-up-days=abc']));
  assert.throws(() => catchUpDaysFromArgs(['node', 'x.ts', '--catch-up-days=0']));
});
