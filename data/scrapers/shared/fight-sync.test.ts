import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planFightSync } from './fight-sync';

function freshFight(overrides: Partial<Parameters<typeof planFightSync>[1][number]> = {}) {
  return {
    fighter1_id: 1,
    fighter2_id: 2,
    fight_finished: false,
    winner_id: null,
    method: '',
    round: 0,
    time: '',
    weight_class: 'Lightweight',
    is_main_event: false,
    ...overrides,
  };
}

test('planFightSync matches an existing fight by fighter pair and marks it for update', () => {
  const existing = [{ id: 42, fighter1_id: 1, fighter2_id: 2 }];
  const fresh = [freshFight({ fight_finished: true, winner_id: 1, method: 'Decision (Unanimous)', round: 3 })];

  const plan = planFightSync(existing, fresh);

  assert.equal(plan.toUpdate.length, 1);
  assert.equal(plan.toUpdate[0].id, 42);
  assert.equal(plan.toUpdate[0].fight.winner_id, 1);
  assert.deepEqual(plan.toInsert, []);
  assert.deepEqual(plan.toDeleteIds, []);
});

test('planFightSync marks a fighter pair with no existing row for insert', () => {
  const existing: Parameters<typeof planFightSync>[0] = [];
  const fresh = [freshFight()];

  const plan = planFightSync(existing, fresh);

  assert.equal(plan.toUpdate.length, 0);
  assert.equal(plan.toInsert.length, 1);
  assert.deepEqual(plan.toDeleteIds, []);
});

test('planFightSync marks an existing row absent from the fresh set for deletion', () => {
  const existing = [{ id: 7, fighter1_id: 5, fighter2_id: 6 }];
  const fresh = [freshFight({ fighter1_id: 1, fighter2_id: 2 })];

  const plan = planFightSync(existing, fresh);

  assert.deepEqual(plan.toDeleteIds, [7]);
  assert.equal(plan.toInsert.length, 1);
});

test('planFightSync handles a full card unchanged run with zero updates needed as pure updates, not deletes', () => {
  const existing = [
    { id: 1, fighter1_id: 10, fighter2_id: 11 },
    { id: 2, fighter1_id: 20, fighter2_id: 21 },
  ];
  const fresh = [
    freshFight({ fighter1_id: 10, fighter2_id: 11 }),
    freshFight({ fighter1_id: 20, fighter2_id: 21 }),
  ];

  const plan = planFightSync(existing, fresh);

  assert.equal(plan.toUpdate.length, 2);
  assert.deepEqual(plan.toInsert, []);
  assert.deepEqual(plan.toDeleteIds, []);
});

test('planFightSync matches an existing fight even if fighter1_id/fighter2_id are swapped on the fresh side', () => {
  const existing = [{ id: 42, fighter1_id: 1, fighter2_id: 2 }];
  const fresh = [freshFight({ fighter1_id: 2, fighter2_id: 1 })];

  const plan = planFightSync(existing, fresh);

  assert.equal(plan.toUpdate.length, 1);
  assert.equal(plan.toUpdate[0].id, 42);
  assert.deepEqual(plan.toInsert, []);
  assert.deepEqual(plan.toDeleteIds, []);
});
