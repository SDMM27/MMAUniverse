import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SEARCH_MAX_LENGTH,
  allFightersHref,
  containsPattern,
  escapeLikePattern,
  flattenResults,
  moveActiveIndex,
  normalizeSearchQuery,
  prefixPattern,
} from './search-utils';

test('normalizeSearchQuery rejects missing and too short queries', () => {
  assert.equal(normalizeSearchQuery(null), null);
  assert.equal(normalizeSearchQuery(' a '), null);
  assert.equal(normalizeSearchQuery('  '), null);
});

test('normalizeSearchQuery trims, collapses whitespace and caps length', () => {
  assert.equal(normalizeSearchQuery('  jon   jones '), 'jon jones');
  assert.equal(normalizeSearchQuery('x'.repeat(500))?.length, SEARCH_MAX_LENGTH);
});

test('escapeLikePattern escapes wildcards and backslashes', () => {
  assert.equal(escapeLikePattern('50%_off\\'), '50\\%\\_off\\\\');
  assert.equal(containsPattern('a_b'), '%a\\_b%');
  assert.equal(prefixPattern('a%'), 'a\\%%');
});

test('flattenResults keeps fighters, events, organizations order', () => {
  const items = flattenResults({
    fighters: [
      { id: 1, name: 'A', image_url: null, nationality: null, weight_class: null, record: null, organization_abbreviation: 'UFC' },
    ],
    events: [{ id: 2, name: 'E', date: '2026-01-01', event_poster: null, organization_abbreviation: 'UFC' }],
    organizations: [{ id: 3, name: 'O', abbreviation: 'O', logo_link: '' }],
  });
  assert.deepEqual(
    items.map((i) => i.href),
    ['/fighters/a', '/events/2', '/organizations/3'],
  );
});

test('moveActiveIndex wraps and handles empty lists', () => {
  assert.equal(moveActiveIndex(-1, 1, 3), 0);
  assert.equal(moveActiveIndex(-1, -1, 3), 2);
  assert.equal(moveActiveIndex(2, 1, 3), 0);
  assert.equal(moveActiveIndex(0, -1, 3), 2);
  assert.equal(moveActiveIndex(0, 1, 0), -1);
});

test('allFightersHref encodes the query', () => {
  assert.equal(allFightersHref('jon & jones'), '/fighters?q=jon%20%26%20jones');
});
