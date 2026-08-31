// data/scrapers/sync-ufc-broadcast-times.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildUfcEventUrl, parseUfcCardTimes } from './sync-ufc-broadcast-times';

// package.json has "type": "module", so this file runs as native ESM under tsx --test —
// __dirname isn't defined there (see parse.test.ts for the same pattern).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, '__fixtures__');
function readFixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf-8');
}

test('buildUfcEventUrl uses /event/ufc-{number} for a numbered event', () => {
  assert.equal(buildUfcEventUrl({ name: 'UFC 332 - TBA', date: '2026-10-03' }), 'https://www.ufc.com/event/ufc-332');
});

test('buildUfcEventUrl uses the date-based Fight Night slug for anything else', () => {
  assert.equal(
    buildUfcEventUrl({ name: 'UFC Fight Night 287 - Hooker vs. Parnasse', date: '2026-09-05' }),
    'https://www.ufc.com/event/ufc-fight-night-september-05-2026',
  );
  assert.equal(
    buildUfcEventUrl({ name: 'UFC Qatar - TBA', date: '2026-11-21' }),
    'https://www.ufc.com/event/ufc-fight-night-november-21-2026',
  );
});

test('parseUfcCardTimes extracts prelims + main card from a 2-tier Fight Night page', () => {
  const { prelimsStart, mainCardStart } = parseUfcCardTimes(readFixture('ufc-com-event-fight-night.html'));
  assert.equal(prelimsStart, '2026-09-05T16:00:00.000Z');
  assert.equal(mainCardStart, '2026-09-05T19:00:00.000Z');
});

test('parseUfcCardTimes takes the earliest tier (Early Prelims) and the last (Main Card) from a 3-tier PPV page', () => {
  const { prelimsStart, mainCardStart } = parseUfcCardTimes(readFixture('ufc-com-event-ppv.html'));
  assert.equal(prelimsStart, '2026-09-19T21:00:00.000Z');
  assert.equal(mainCardStart, '2026-09-20T01:00:00.000Z');
});

test('parseUfcCardTimes returns nulls for a not-yet-published event (search redirect page)', () => {
  const { prelimsStart, mainCardStart } = parseUfcCardTimes(readFixture('ufc-com-event-not-found.html'));
  assert.equal(prelimsStart, null);
  assert.equal(mainCardStart, null);
});
