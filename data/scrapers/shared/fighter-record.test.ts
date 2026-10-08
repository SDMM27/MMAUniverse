import { test } from 'node:test';
import assert from 'node:assert/strict';
import { currentRecord } from './fighter-record';
import type { ScrapedFightHistoryEntry } from './types';

const fights = (...results: string[]) => results.map((result) => ({ result }) as ScrapedFightHistoryEntry);

test('currentRecord counts a win the scraped header has not caught up with', () => {
  assert.equal(currentRecord({ record: '17-2-0', fight_history: fights('win', ...Array(17).fill('win'), 'loss', 'loss') }), '18-2-0');
});

test('currentRecord ignores no contests, like the Sherdog header does', () => {
  assert.equal(currentRecord({ record: '1-1-0', fight_history: fights('win', 'loss', 'nc', 'draw') }), '1-1-1');
});

test('currentRecord keeps the scraped record when there is no history', () => {
  assert.equal(currentRecord({ record: '5-0-0' }), '5-0-0');
  assert.equal(currentRecord({ record: '5-0-0', fight_history: [] }), '5-0-0');
});

test('currentRecord keeps the scraped record when the history is shorter (homonym page)', () => {
  assert.equal(currentRecord({ record: '9-5-0', fight_history: fights('win') }), '9-5-0');
});
