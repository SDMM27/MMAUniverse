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

test('parseUfcRankings drops the redundant champion row for Pound-for-Pound tables (no real titleholder -- ufc.com just repeats the #1 contender in the caption)', () => {
  const rankings = parseUfcRankings(readFixture('ufc-com-rankings.html'));
  const p4p = rankings.filter((r) => r.weightClass === "Men's Pound-for-Pound Top Rank");
  assert.equal(p4p.length, 15); // no rank-0 entry, just #1-15
  assert.equal(p4p.filter((r) => r.rank === 0).length, 0);
  assert.equal(p4p.find((r) => r.rank === 1)?.fighterName, 'Islam Makhachev');
});

test('parseUfcRankings keeps the champion row for a real division (a different person than #1)', () => {
  const rankings = parseUfcRankings(readFixture('ufc-com-rankings.html'));
  const flyweight = rankings.filter((r) => r.weightClass === 'Flyweight');
  assert.equal(flyweight.find((r) => r.rank === 0)?.fighterName, 'Joshua Van');
  assert.notEqual(flyweight.find((r) => r.rank === 0)?.fighterName, flyweight.find((r) => r.rank === 1)?.fighterName);
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

// Regression test for a real bug (found 2026-09-15): ufc.com genuinely ties
// two fighters at the same rank sometimes (confirmed live -- Men's P4P had
// Joshua Van and Ciryl Gane both at rank 10, 11 skipped). The parser itself
// was never the problem -- it already preserved both rows correctly, no
// dedup-by-rank logic exists here to begin with -- the crash was a DB
// UNIQUE(organization_id, weight_class, rank) constraint rejecting the tie
// as a duplicate key (fixed in sync-ufc-rankings.ts's ensureSchema). This
// test locks in that the parser keeps both tied rows rather than silently
// dropping one, so a future refactor doesn't reintroduce the same bug from
// the other direction.
test('parseUfcRankings keeps both fighters when ufc.com ties two of them at the same rank', () => {
  const html = `
    <table>
      <caption><h4>Lightweight</h4></caption>
      <tbody>
        <tr><td class="views-field-weight-class-rank">9</td><td class="views-field-title"><a>Fighter Nine</a></td></tr>
        <tr><td class="views-field-weight-class-rank">10</td><td class="views-field-title"><a>Fighter Ten A</a></td></tr>
        <tr><td class="views-field-weight-class-rank">10</td><td class="views-field-title"><a>Fighter Ten B</a></td></tr>
        <tr><td class="views-field-weight-class-rank">12</td><td class="views-field-title"><a>Fighter Twelve</a></td></tr>
      </tbody>
    </table>
  `;
  const rankings = parseUfcRankings(html);
  const tiedAtTen = rankings.filter((r) => r.rank === 10);

  assert.equal(tiedAtTen.length, 2);
  assert.deepEqual(
    tiedAtTen.map((r) => r.fighterName).sort(),
    ['Fighter Ten A', 'Fighter Ten B'],
  );
});
