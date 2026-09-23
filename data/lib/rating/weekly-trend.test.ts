// data/lib/rating/weekly-trend.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankTrend, weekStartIso } from './weekly-trend';

test('weekStartIso: any day maps to the Monday of its week', () => {
  assert.equal(weekStartIso('2026-09-21'), '2026-09-21'); // Monday
  assert.equal(weekStartIso('2026-09-23'), '2026-09-21'); // Wednesday
  assert.equal(weekStartIso('2026-09-27'), '2026-09-21'); // Sunday
  assert.equal(weekStartIso('2026-09-28'), '2026-09-28');
  assert.equal(weekStartIso('2027-01-01'), '2026-12-28'); // across a year boundary
});

test('rankTrend: nothing to show without an earlier snapshot', () => {
  assert.deepEqual(rankTrend(3, null, false), { kind: 'none' });
  assert.deepEqual(rankTrend(3, 5, false), { kind: 'none' });
});

test('rankTrend: up, down, same, new', () => {
  assert.deepEqual(rankTrend(3, 5, true), { kind: 'up', places: 2 });
  assert.deepEqual(rankTrend(6, 5, true), { kind: 'down', places: 1 });
  assert.deepEqual(rankTrend(5, 5, true), { kind: 'same' });
  assert.deepEqual(rankTrend(5, null, true), { kind: 'new' });
  assert.deepEqual(rankTrend(0, 2, true), { kind: 'up', places: 2 }); // contender #2 won the belt
});
