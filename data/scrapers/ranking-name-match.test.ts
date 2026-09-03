// data/scrapers/ranking-name-match.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchFighterByName, normalizeFighterName } from './ranking-name-match';

test('normalizeFighterName strips diacritics, punctuation and extra whitespace', () => {
  assert.equal(normalizeFighterName("Uroš Medić"), 'uros medic');
  assert.equal(normalizeFighterName('Lone’er Kavanagh'), 'loneer kavanagh');
  // ł (U+0142) isn't a combining diacritic on a base letter -- it's its own
  // codepoint, so NFD can't decompose it and it just falls out of the
  // punctuation strip below. A known, accepted gap (see matchFighterByName's
  // doc comment) rather than something this normalization claims to solve.
  assert.equal(normalizeFighterName('  Jan   Błachowicz '), 'jan bachowicz');
});

test('matchFighterByName matches on exact normalized equality', () => {
  const candidates = [{ id: 1, name: 'Uroš Medić' }, { id: 2, name: 'Ian Garry' }];
  assert.equal(matchFighterByName('Uros Medic', candidates)?.id, 1);
});

test('matchFighterByName matches a shorter DB name against a fuller scraped name (e.g. a newly-added middle name)', () => {
  const candidates = [{ id: 5, name: 'Ian Garry' }];
  assert.equal(matchFighterByName('Ian Machado Garry', candidates)?.id, 5);
});

test('matchFighterByName matches a fuller DB name against a shorter scraped name', () => {
  const candidates = [{ id: 5, name: 'Ian Machado Garry' }];
  assert.equal(matchFighterByName('Ian Garry', candidates)?.id, 5);
});

test('matchFighterByName does not match on a single shared word alone', () => {
  const candidates = [{ id: 1, name: 'Garry Smith' }, { id: 2, name: 'Ian Jones' }];
  assert.equal(matchFighterByName('Ian Garry', candidates), null);
});

test('matchFighterByName requires in-order words, not just a shared word set', () => {
  const candidates = [{ id: 1, name: 'Garry Ian' }]; // same two words, reversed
  assert.equal(matchFighterByName('Ian Garry', candidates), null);
});

test('matchFighterByName returns null when nothing matches', () => {
  assert.equal(matchFighterByName('Nobody Here', [{ id: 1, name: 'Someone Else' }]), null);
});
