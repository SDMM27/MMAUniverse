// data/lib/rating/order-division.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderDivisionWithChampionPinned, groupFighterRatingsByWeightClass, sortWeightClassGroups } from './order-division';
import type { FighterRatingWithFighter } from '../definitions';

function fighter(overrides: Partial<FighterRatingWithFighter>): FighterRatingWithFighter {
  return {
    id: 1,
    fighter_id: 1,
    weight_class: 'Lightweight',
    points: 0.1,
    display_score: 50,
    rating_deviation: null,
    p4p_score: null,
    ml_win_probability: null,
    current_streak: 0,
    is_former_champion: false,
    style_archetype: null,
    fights_rated: 5,
    last_fight_date: '2026-01-01',
    is_champion: false,
    is_ranking_eligible: true,
    updated_at: '2026-01-01T00:00:00.000Z',
    fighter_name: 'Fighter',
    fighter_image_url: null,
    fighter_nationality: null,
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

// Regression test for a real bug (found live on /classement-calcule,
// 2026-09-15): fighter_ratings.display_score is a Postgres NUMERIC column,
// which the neon driver returns as a **string** at runtime, not the
// `number` FighterRating declares (see the type's own doc comment in
// definitions.ts). The tests above all pass plain JS numbers, which never
// exercised this -- these two explicitly mimic the real DB shape with
// string values (`as unknown as number`, matching how the driver actually
// hands them back despite the type) to lock in that `championOutranked`
// compares numerically, not lexicographically ("99.0" > "100.0" is true as
// strings -- backwards from the numeric truth).
test('championOutranked compares display_score numerically even when it arrives as a string (real DB shape)', () => {
  const champion = fighter({ fighter_name: 'Champion', is_champion: true, display_score: '100.0' as unknown as number });
  const contender = fighter({ fighter_name: 'Contender', display_score: '99.0' as unknown as number });

  const result = orderDivisionWithChampionPinned([contender, champion]);

  assert.equal(result.championOutranked, false, 'the champion (100.0) is not outranked by 99.0, despite "99.0" > "100.0" as strings');
});

test('championOutranked still catches a real outrank when scores are strings with different digit counts', () => {
  const champion = fighter({ fighter_name: 'Champion', is_champion: true, display_score: '92.3' as unknown as number });
  const contender = fighter({ fighter_name: 'Contender', display_score: '100.0' as unknown as number });

  const result = orderDivisionWithChampionPinned([contender, champion]);

  assert.equal(result.championOutranked, true, 'the champion (92.3) is genuinely outranked by 100.0, despite "100.0" < "92.3" as strings');
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

test('sortWeightClassGroups orders lightest to heaviest, men before women, unknown last', () => {
  const groups = ['Heavyweight', "Women's Flyweight", 'Openweight', 'Flyweight', "Women's Strawweight", 'Lightweight'].map((weightClass) => ({ weightClass }));
  assert.deepEqual(
    sortWeightClassGroups(groups).map((g) => g.weightClass),
    ['Flyweight', 'Lightweight', 'Heavyweight', "Women's Strawweight", "Women's Flyweight", 'Openweight'],
  );
});
