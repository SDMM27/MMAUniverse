// data/scrapers/ranking-name-match.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchFighterByName, normalizeFighterName } from './ranking-name-match';

test('normalizeFighterName strips diacritics, punctuation and extra whitespace', () => {
  assert.equal(normalizeFighterName("Uroš Medić"), 'uros medic');
  assert.equal(normalizeFighterName('Lone’er Kavanagh'), 'loneer kavanagh');
  // ł (U+0142) isn't a combining diacritic -- NFD can't decompose it, so it's mapped by hand.
  assert.equal(normalizeFighterName('  Jan   Błachowicz '), 'jan blachowicz');
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

test('matchFighterByName matches a reversed family-name order', () => {
  assert.equal(matchFighterByName('Zhang Weili', [{ id: 1, name: 'Weili Zhang' }])?.id, 1);
});

test('matchFighterByName handles St./Saint, hyphens, suffixes and joined given names', () => {
  assert.equal(matchFighterByName('Benoît Saint Denis', [{ id: 1, name: 'Benoit St. Denis' }])?.id, 1);
  assert.equal(matchFighterByName('Waldo Cortes Acosta', [{ id: 1, name: 'Waldo Cortes-Acosta' }])?.id, 1);
  assert.equal(matchFighterByName('Khalil Rountree Jr.', [{ id: 1, name: 'Khalil Rountree' }])?.id, 1);
  assert.equal(matchFighterByName('JunYong Park', [{ id: 1, name: 'Jun Yong Park' }])?.id, 1);
  assert.equal(matchFighterByName('Jan Błachowicz', [{ id: 1, name: 'Jan Blachowicz' }])?.id, 1);
});

test('matchFighterByName matches a short first name with the same surname', () => {
  assert.equal(matchFighterByName('Phil Rowe', [{ id: 1, name: 'Philip Rowe' }, { id: 2, name: 'Phil Davis' }])?.id, 1);
});

test('matchFighterByName resolves known ring names', () => {
  assert.equal(matchFighterByName('Renato Moicano', [{ id: 1, name: 'Renato Carneiro' }])?.id, 1);
});

test('matchFighterByName returns null when a loose level is ambiguous', () => {
  const candidates = [{ id: 1, name: 'Lance Gibson Jr.' }, { id: 2, name: 'Lance  Gibson Sr.' }];
  assert.equal(matchFighterByName('Lance Gibson', candidates), null);
});

test('matchFighterByName returns null when nothing matches', () => {
  assert.equal(matchFighterByName('Nobody Here', [{ id: 1, name: 'Someone Else' }]), null);
});
