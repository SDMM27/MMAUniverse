// data/lib/event-utils.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeNextEventForHome, groupUpcomingByWeek, prioritizeOrganization, selectHeadlineFightPerEvent, splitEventsByStatus, formatEventDate, displayEventName } from './event-utils';
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

function makeEventWithOrg(id: number, date: string, organizationAbbreviation: string): Event & { organization_abbreviation: string } {
  return { ...makeEvent(id, date), organization_abbreviation: organizationAbbreviation };
}

function makeFight(eventId: number, id: number, isMainEvent: boolean): { event_id: number; id: number; is_main_event: boolean } {
  return { event_id: eventId, id, is_main_event: isMainEvent };
}

test('computeNextEventForHome returns the next UFC event even when another org has a sooner one', () => {
  const events = [
    makeEventWithOrg(1, FUTURE[0], 'PFL'),
    makeEventWithOrg(2, FUTURE[1], 'UFC'),
  ];

  const result = computeNextEventForHome(events);

  assert.equal(result?.event.id, 2);
  assert.equal(result?.isUpcoming, true);
});

test('computeNextEventForHome picks the soonest UFC event when several are upcoming', () => {
  const events = [
    makeEventWithOrg(1, FUTURE[2], 'UFC'),
    makeEventWithOrg(2, FUTURE[0], 'UFC'),
    makeEventWithOrg(3, FUTURE[1], 'UFC'),
  ];

  const result = computeNextEventForHome(events);

  assert.equal(result?.event.id, 2);
});

test('computeNextEventForHome falls back to the next event of any org when no UFC event is upcoming', () => {
  const events = [
    makeEventWithOrg(1, PAST[0], 'UFC'),
    makeEventWithOrg(2, FUTURE[0], 'PFL'),
  ];

  const result = computeNextEventForHome(events);

  assert.equal(result?.event.id, 2);
  assert.equal(result?.isUpcoming, true);
});

test('computeNextEventForHome falls back to the last past event of any org when nothing is upcoming anywhere', () => {
  const events = [
    makeEventWithOrg(1, PAST[0], 'UFC'),
    makeEventWithOrg(2, PAST[1], 'PFL'),
  ];

  const result = computeNextEventForHome(events);

  assert.equal(result?.event.id, 2);
  assert.equal(result?.isUpcoming, false);
});

test('computeNextEventForHome returns null for an empty input', () => {
  assert.equal(computeNextEventForHome([]), null);
});

test('prioritizeOrganization moves priority-org items before others, preserving relative order within each group', () => {
  const items = [
    { id: 1, organization_abbreviation: 'PFL' },
    { id: 2, organization_abbreviation: 'UFC' },
    { id: 3, organization_abbreviation: 'PFL' },
    { id: 4, organization_abbreviation: 'UFC' },
  ];

  const result = prioritizeOrganization(items, 'UFC');

  assert.deepEqual(
    result.map((item) => item.id),
    [2, 4, 1, 3],
  );
});

test('prioritizeOrganization returns items unchanged in order when none match', () => {
  const items = [
    { id: 1, organization_abbreviation: 'PFL' },
    { id: 2, organization_abbreviation: 'Bellator' },
  ];

  const result = prioritizeOrganization(items, 'UFC');

  assert.deepEqual(
    result.map((item) => item.id),
    [1, 2],
  );
});

test('prioritizeOrganization returns an empty array for an empty input', () => {
  assert.deepEqual(prioritizeOrganization([], 'UFC'), []);
});

test('selectHeadlineFightPerEvent keeps the is_main_event fight for a given event_id', () => {
  const fights = [makeFight(1, 10, false), makeFight(1, 11, true), makeFight(1, 12, false)];

  const result = selectHeadlineFightPerEvent(fights);

  assert.deepEqual(
    result.map((f) => f.id),
    [11],
  );
});

test('selectHeadlineFightPerEvent falls back to the lowest id when no fight is flagged is_main_event', () => {
  const fights = [makeFight(1, 20, false), makeFight(1, 18, false), makeFight(1, 25, false)];

  const result = selectHeadlineFightPerEvent(fights);

  assert.deepEqual(
    result.map((f) => f.id),
    [18],
  );
});

test('selectHeadlineFightPerEvent picks the lowest id among multiple is_main_event fights for the same event', () => {
  const fights = [makeFight(1, 30, true), makeFight(1, 28, true)];

  const result = selectHeadlineFightPerEvent(fights);

  assert.deepEqual(
    result.map((f) => f.id),
    [28],
  );
});

test('selectHeadlineFightPerEvent keeps one entry per distinct event_id, in order of first appearance', () => {
  const fights = [makeFight(2, 40, true), makeFight(1, 10, true), makeFight(2, 41, false), makeFight(3, 50, true)];

  const result = selectHeadlineFightPerEvent(fights);

  assert.deepEqual(
    result.map((f) => f.event_id),
    [2, 1, 3],
  );
});

test('selectHeadlineFightPerEvent returns an empty array for empty input', () => {
  const result = selectHeadlineFightPerEvent([]);

  assert.deepEqual(result, []);
});

test('formatEventDate writes an ISO date in French, without shifting the day', () => {
  assert.equal(formatEventDate('2026-10-10'), '10 oct. 2026');
  assert.equal(formatEventDate('2026-10-10', { weekday: true }), 'sam. 10 oct. 2026');
  assert.equal(formatEventDate('2026-01-01'), '1 janv. 2026');
});

test('formatEventDate leaves anything that is not an ISO date alone', () => {
  assert.equal(formatEventDate('TBA'), 'TBA');
  assert.equal(formatEventDate(null), '');
});

test('displayEventName drops a promotion prefix the rest of the name already covers', () => {
  assert.equal(displayEventName('Professional Fighters League - PFL Tampa: Cyborg vs. Vieira'), 'PFL Tampa: Cyborg vs. Vieira');
  assert.equal(displayEventName('One Championship - One Friday Fights 168'), 'One Friday Fights 168');
  assert.equal(displayEventName('Rizin FF - Rizin 54'), 'Rizin 54');
  assert.equal(displayEventName('CW 209 - Cage Warriors 209: Newcastle'), 'Cage Warriors 209: Newcastle');
  assert.equal(displayEventName('HXMMA 45 - Hexagone MMA 45'), 'Hexagone MMA 45');
  assert.equal(displayEventName('CW 158	 - Cage Warriors 158: Rome'), 'Cage Warriors 158: Rome');
});

test('displayEventName keeps names whose prefix carries information', () => {
  assert.equal(displayEventName('UFC 331 - Van vs. Pantoja 2'), 'UFC 331 - Van vs. Pantoja 2');
  assert.equal(displayEventName('UFC Fight Night 290 - Allen vs. Duncan'), 'UFC Fight Night 290 - Allen vs. Duncan');
  assert.equal(displayEventName('ACB 90 - Moscow'), 'ACB 90 - Moscow');
  assert.equal(displayEventName('Bellator Champions Series London - McCourt vs. Collins'), 'Bellator Champions Series London - McCourt vs. Collins');
  assert.equal(displayEventName('UFC 37.5 - As Real As It Gets'), 'UFC 37.5 - As Real As It Gets');
});
