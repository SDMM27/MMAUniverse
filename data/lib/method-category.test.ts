import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMethodCategory } from './method-category';

test('normalizeMethodCategory maps KO methods', () => {
  assert.equal(normalizeMethodCategory('KO (Punches)'), 'ko_tko');
  assert.equal(normalizeMethodCategory('KO (Head Kick)'), 'ko_tko');
});

test('normalizeMethodCategory maps TKO methods', () => {
  assert.equal(normalizeMethodCategory('TKO (Doctor Stoppage)'), 'ko_tko');
  assert.equal(normalizeMethodCategory('TKO (Punches)'), 'ko_tko');
});

test('normalizeMethodCategory maps Submission methods', () => {
  assert.equal(normalizeMethodCategory('Submission (Rear-Naked Choke)'), 'submission');
  assert.equal(normalizeMethodCategory('Technical Submission (Kimura)'), 'submission');
});

test('normalizeMethodCategory tolerates the real "Submision" scraper typo', () => {
  assert.equal(normalizeMethodCategory('Submision (Arm-Triangle Choke)'), 'submission');
});

test('normalizeMethodCategory maps Decision methods', () => {
  assert.equal(normalizeMethodCategory('Decision (Unanimous)'), 'decision');
  assert.equal(normalizeMethodCategory('Decision (Split)'), 'decision');
  assert.equal(normalizeMethodCategory('Technical Decision (Majority)'), 'decision');
});

test('normalizeMethodCategory returns other for unpredictable outcomes', () => {
  assert.equal(normalizeMethodCategory('Disqualification (Biting)'), 'other');
  assert.equal(normalizeMethodCategory('No Contest'), 'other');
  assert.equal(normalizeMethodCategory('No Contest (Accidental Clash of Heads)'), 'other');
  assert.equal(normalizeMethodCategory('Draw (Majority)'), 'other');
  assert.equal(normalizeMethodCategory('Technical Draw'), 'other');
  assert.equal(normalizeMethodCategory(''), 'other');
});

test('normalizeMethodCategory is case-insensitive', () => {
  assert.equal(normalizeMethodCategory('ko (punches)'), 'ko_tko');
  assert.equal(normalizeMethodCategory('DECISION (UNANIMOUS)'), 'decision');
});
