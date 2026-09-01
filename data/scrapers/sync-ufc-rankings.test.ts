// data/scrapers/sync-ufc-rankings.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseUfcRankings } from './sync-ufc-rankings';

// package.json has "type": "module", so this file runs as native ESM under
// tsx --test -- __dirname isn't defined there (same pattern as parse.test.ts).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, '__fixtures__');
function readFixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf-8');
}

test('parseUfcRankings extracts the champion + 15 ranked contenders for a division', () => {
  const rankings = parseUfcRankings(readFixture('ufc-com-rankings.html'));
  const flyweight = rankings.filter((r) => r.weightClass === 'Flyweight');
  assert.equal(flyweight.length, 16); // champion (rank 0) + 15 ranked contenders
  assert.equal(flyweight.find((r) => r.rank === 0)?.fighterName, 'Joshua Van');
  assert.equal(flyweight.find((r) => r.rank === 1)?.fighterName, 'Alexandre Pantoja');
  assert.equal(flyweight.find((r) => r.rank === 15)?.fighterName, 'Charles Johnson');
});

test('parseUfcRankings dedupes the Meta tab against the duplicate Media Panel tab', () => {
  const rankings = parseUfcRankings(readFixture('ufc-com-rankings.html'));
  // Each division's table appears twice in the raw HTML (see file header of
  // sync-ufc-rankings.ts) -- without dedupe this would be 32, not 16.
  const flyweight = rankings.filter((r) => r.weightClass === 'Flyweight');
  assert.equal(flyweight.length, 16);
});

test('parseUfcRankings discovers the table list dynamically rather than assuming a fixed set', () => {
  const rankings = parseUfcRankings(readFixture('ufc-com-rankings.html'));
  const weightClasses = new Set(rankings.map((r) => r.weightClass));
  // 8 men's divisions + 3 women's divisions, at minimum -- Pound-for-Pound
  // table(s) are additional and not guaranteed to always be present.
  assert.ok(weightClasses.size >= 11, `expected at least 11 divisions, got ${weightClasses.size}`);
});

test('parseUfcRankings returns an empty array for HTML with no ranking tables', () => {
  assert.deepEqual(parseUfcRankings('<html><body>not found</body></html>'), []);
});
