import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inferGenders, type Gender } from './infer-gender';

const edges = (...pairs: string[]) => pairs.map((pair) => pair.split('-') as [string, string]);

test('inferGenders spreads a known gender to opponents, and their opponents', () => {
  const genders = inferGenders(new Map<string, Gender>([['a', 'women']]), edges('a-b', 'b-c'));
  assert.equal(genders.get('b'), 'women');
  assert.equal(genders.get('c'), 'women');
});

test('inferGenders gives each fighter the gender of the nearest seed (one bad edge stays local)', () => {
  // w1 - x - y - z - m1, plus a bad edge x - m2: x is one hop from both sides.
  const seeds = new Map<string, Gender>([['w1', 'women'], ['m1', 'men'], ['m2', 'men']]);
  const genders = inferGenders(seeds, edges('w1-x', 'x-y', 'y-z', 'z-m1', 'x-m2'));
  assert.equal(genders.has('x'), false); // tie at distance 1: unknown
  assert.equal(genders.get('z'), 'men');
});

test('inferGenders leaves unreachable fighters unknown', () => {
  const genders = inferGenders(new Map<string, Gender>([['a', 'men']]), edges('b-c'));
  assert.equal(genders.has('b'), false);
});
