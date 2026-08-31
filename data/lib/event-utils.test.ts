// data/lib/event-utils.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupUpcomingByWeek, splitEventsByStatus } from './event-utils';
import type { Event } from './definitions';

// Dates far enough in the past/future to stay stable regardless of when the
// test suite runs.
const PAST = ['2000-01-01', '2000-06-15', '2000-12-31'];
const FUTURE = ['2999-01-01', '2999-06-15', '2999-12-31'];

function makeEvent(id: number, date: string): Event {
  return {
    id,
    name: `Event ${id}`,
    date,
    start_time: null,
    prelims_start: null,
    main_card_start: null,
    event_location: 'Somewhere',
    event_poster: '',
    organization_id: 1,
  };
}

test('splitEventsByStatus separates future dates into upcoming and past ones into past', () => {
  const events = [makeEvent(1, PAST[0]), makeEvent(2, FUTURE[0]), makeEvent(3, PAST[1])];

  const { upcoming, past } = splitEventsByStatus(events);

  assert.deepEqual(
    upcoming.map((e) => e.id),
    [2],
  );
  assert.deepEqual(
    past.map((e) => e.id),
    [3, 1],
  );
});

test('splitEventsByStatus sorts upcoming events soonest-first', () => {
  const events = [makeEvent(1, FUTURE[2]), makeEvent(2, FUTURE[0]), makeEvent(3, FUTURE[1])];

  const { upcoming } = splitEventsByStatus(events);

  assert.deepEqual(
    upcoming.map((e) => e.date),
    [FUTURE[0], FUTURE[1], FUTURE[2]],
  );
});

test('splitEventsByStatus sorts past events most-recent-first', () => {
  const events = [makeEvent(1, PAST[0]), makeEvent(2, PAST[2]), makeEvent(3, PAST[1])];

  const { past } = splitEventsByStatus(events);

  assert.deepEqual(
    past.map((e) => e.date),
    [PAST[2], PAST[1], PAST[0]],
  );
});

test('splitEventsByStatus treats an event dated today as upcoming', () => {
  const today = new Date().toISOString().slice(0, 10);
  const events = [makeEvent(1, today)];

  const { upcoming, past } = splitEventsByStatus(events);

  assert.deepEqual(
    upcoming.map((e) => e.id),
    [1],
  );
  assert.equal(past.length, 0);
});

test('splitEventsByStatus returns empty groups for an empty input', () => {
  const { upcoming, past } = splitEventsByStatus([]);

  assert.deepEqual(upcoming, []);
  assert.deepEqual(past, []);
});

test('groupUpcomingByWeek puts an event dated today in thisWeek', () => {
  const today = new Date().toISOString().slice(0, 10);
  const { thisWeek, later } = groupUpcomingByWeek([makeEvent(1, today)]);

  assert.deepEqual(
    thisWeek.map((e) => e.id),
    [1],
  );
  assert.equal(later.length, 0);
});

test('groupUpcomingByWeek puts an event 60 days out in later', () => {
  const farFuture = new Date();
  farFuture.setUTCDate(farFuture.getUTCDate() + 60);
  const farFutureDate = farFuture.toISOString().slice(0, 10);

  const { thisWeek, later } = groupUpcomingByWeek([makeEvent(1, farFutureDate)]);

  assert.equal(thisWeek.length, 0);
  assert.deepEqual(
    later.map((e) => e.id),
    [1],
  );
});

test('groupUpcomingByWeek splits a mixed list correctly', () => {
  const today = new Date().toISOString().slice(0, 10);
  const farFuture = new Date();
  farFuture.setUTCDate(farFuture.getUTCDate() + 60);
  const farFutureDate = farFuture.toISOString().slice(0, 10);

  const { thisWeek, later } = groupUpcomingByWeek([makeEvent(1, today), makeEvent(2, farFutureDate)]);

  assert.deepEqual(
    thisWeek.map((e) => e.id),
    [1],
  );
  assert.deepEqual(
    later.map((e) => e.id),
    [2],
  );
});

test('groupUpcomingByWeek returns empty groups for an empty input', () => {
  const { thisWeek, later } = groupUpcomingByWeek([]);

  assert.deepEqual(thisWeek, []);
  assert.deepEqual(later, []);
});
