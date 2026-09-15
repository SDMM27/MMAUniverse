// data/lib/rating/order-division.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderDivisionWithChampionPinned, groupFighterRatingsByWeightClass } from './order-division';
import type { FighterRatingWithFighter } from '../definitions';

function fighter(overrides: Partial<FighterRatingWithFighter>): FighterRatingWithFighter {
  return {
    id: 1,
    fighter_id: 1,
    weight_class: 'Lightweight',
    points: 0.1,
    display_score: 50,
    current_streak: 0,
    is_former_champion: false,
    style_archetype: null,
    fights_rated: 5,
    last_fight_date: '2026-01-01',
    is_champion: false,
    updated_at: '2026-01-01T00:00:00.000Z',
    fighter_name: 'Fighter',
    fighter_image_url: null,
    ...overrides,
  };
}

test('champion with the highest score stays at index 0, no asterisk', () => {
  const champion = fighter({ fighter_name: 'Champion', is_champion: true, display_score: 90 });
  const contender1 = fighter({ fighter_name: 'Contender 1', display_score: 70 });
  const contender2 = fighter({ fighter_name: 'Contender 2', display_score: 60 });

  const result = orderDivisionWithChampionPinned([contender2, champion, contender1]);

  assert.deepEqual(
    result.fighters.map((f) => f.fighter_name),
    ['Champion', 'Contender 1', 'Contender 2'],
  );
  assert.equal(result.championOutranked, false);
});

test('champion with a lower score than a contender is still pinned at index 0, but flagged outranked', () => {
  const champion = fighter({ fighter_name: 'Champion', is_champion: true, display_score: 50 });
  const contender1 = fighter({ fighter_name: 'Contender 1', display_score: 90 });
  const contender2 = fighter({ fighter_name: 'Contender 2', display_score: 70 });

  const result = orderDivisionWithChampionPinned([contender1, contender2, champion]);

  assert.deepEqual(
    result.fighters.map((f) => f.fighter_name),
    ['Champion', 'Contender 1', 'Contender 2'],
  );
  assert.equal(result.championOutranked, true);
});

test('a division with no matched champion just sorts by display_score descending', () => {
  const a = fighter({ fighter_name: 'A', display_score: 30 });
  const b = fighter({ fighter_name: 'B', display_score: 80 });
  const c = fighter({ fighter_name: 'C', display_score: 55 });

  const result = orderDivisionWithChampionPinned([a, b, c]);

  assert.deepEqual(
    result.fighters.map((f) => f.fighter_name),
    ['B', 'C', 'A'],
  );
  assert.equal(result.championOutranked, false);
});

test('a division of just the champion has no one to be outranked by', () => {
  const champion = fighter({ fighter_name: 'Champion', is_champion: true, display_score: 40 });

  const result = orderDivisionWithChampionPinned([champion]);

  assert.deepEqual(result.fighters, [champion]);
  assert.equal(result.championOutranked, false);
});

test('an empty division returns an empty ordering', () => {
  const result = orderDivisionWithChampionPinned([]);
  assert.deepEqual(result, { fighters: [], championOutranked: false });
});

test('groupFighterRatingsByWeightClass buckets by weight_class, first-seen order', () => {
  const lw1 = fighter({ fighter_name: 'LW1', weight_class: 'Lightweight' });
  const hw1 = fighter({ fighter_name: 'HW1', weight_class: 'Heavyweight' });
  const lw2 = fighter({ fighter_name: 'LW2', weight_class: 'Lightweight' });

  const groups = groupFighterRatingsByWeightClass([lw1, hw1, lw2]);

  assert.deepEqual(
    groups.map((g) => g.weightClass),
    ['Lightweight', 'Heavyweight'],
  );
  assert.deepEqual(
    groups[0].fighters.map((f) => f.fighter_name),
    ['LW1', 'LW2'],
  );
  assert.deepEqual(groups[1].fighters.map((f) => f.fighter_name), ['HW1']);
});
