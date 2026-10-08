// data/lib/fight-utils.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitMainEvent, getScheduledRounds, displayWeightClass } from './fight-utils';

type FightStub = { id: number; is_main_event: boolean };

function makeFight(id: number, isMainEvent: boolean): FightStub {
  return { id, is_main_event: isMainEvent };
}

test('splitMainEvent pulls out the flagged fight and keeps the rest in order', () => {
  const fights = [makeFight(1, false), makeFight(2, true), makeFight(3, false)];

  const { mainEvent, rest } = splitMainEvent(fights);

  assert.equal(mainEvent?.id, 2);
  assert.deepEqual(
    rest.map((f) => f.id),
    [1, 3],
  );
});

test('splitMainEvent returns a null mainEvent and the full list when nothing is flagged', () => {
  const fights = [makeFight(1, false), makeFight(2, false)];

  const { mainEvent, rest } = splitMainEvent(fights);

  assert.equal(mainEvent, null);
  assert.deepEqual(
    rest.map((f) => f.id),
    [1, 2],
  );
});

test('splitMainEvent returns empty results for an empty input', () => {
  const { mainEvent, rest } = splitMainEvent([]);

  assert.equal(mainEvent, null);
  assert.deepEqual(rest, []);
});

test('splitMainEvent excludes every flagged fight from rest, even if more than one is flagged', () => {
  const fights = [makeFight(1, true), makeFight(2, false), makeFight(3, true)];

  const { mainEvent, rest } = splitMainEvent(fights);

  assert.equal(mainEvent?.id, 1);
  assert.deepEqual(
    rest.map((f) => f.id),
    [2],
  );
});

test('getScheduledRounds returns 5 for the main event and 3 for every other fight', () => {
  assert.equal(getScheduledRounds({ is_main_event: true, is_title_fight: false }), 5);
  assert.equal(getScheduledRounds({ is_main_event: false, is_title_fight: false }), 3);
});

test('getScheduledRounds returns 5 for a title fight even when it is not the main event (a title co-main)', () => {
  assert.equal(getScheduledRounds({ is_main_event: false, is_title_fight: true }), 5);
});

test('displayWeightClass prefixes the shared division names for women only', () => {
  assert.equal(displayWeightClass('Flyweight', true), "Women's Flyweight");
  assert.equal(displayWeightClass('Flyweight', false), 'Flyweight');
  assert.equal(displayWeightClass('Flyweight', null), 'Flyweight');
  assert.equal(displayWeightClass("Women's Flyweight", true), "Women's Flyweight");
  assert.equal(displayWeightClass('Lightweight', true), "Women's Lightweight"); // PFL
  assert.equal(displayWeightClass('125lb Catchweight', true), '125lb Catchweight');
  assert.equal(displayWeightClass(null, true), null);
});
