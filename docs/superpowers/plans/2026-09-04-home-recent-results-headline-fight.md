# Un seul combat (le main event) par événement dans "Derniers résultats" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the home page's "Derniers résultats" section show one fight per event (that event's headline/main-event fight) instead of potentially several arbitrarily-ordered fights from the same card, so the latest UFC main event is guaranteed to show up.

**Architecture:** Add a pure, unit-tested function `selectHeadlineFightPerEvent` to `data/lib/event-utils.ts` that reduces a fight list to one entry per `event_id` (preferring `is_main_event: true`, falling back to the lowest `id`). Splice it into `fetchRecentFinishedFights` in `data/lib/data.ts`, between the SQL fetch and the existing `prioritizeOrganization` UFC-first sort, and widen the raw-fight pool it draws from so enough distinct events survive the reduction.

**Tech Stack:** TypeScript, Next.js App Router, Neon Postgres (`@neondatabase/serverless`), Node's built-in test runner (`node:test` + `node:assert/strict`) via `tsx --test`.

**Spec:** [docs/superpowers/specs/2026-09-04-home-recent-results-headline-fight-design.md](../specs/2026-09-04-home-recent-results-headline-fight-design.md)

---

### Task 1: `selectHeadlineFightPerEvent` — failing tests

**Files:**
- Modify: `data/lib/event-utils.test.ts`

- [ ] **Step 1: Add a `makeFight` fixture helper and the import**

Add `selectHeadlineFightPerEvent` to the existing import from `./event-utils`, and add a small fixture helper near `makeEvent` (top of the file, after the existing `makeEvent` function):

```typescript
import { computeNextEventForHome, groupUpcomingByWeek, prioritizeOrganization, selectHeadlineFightPerEvent, splitEventsByStatus } from './event-utils';
```

```typescript
function makeFight(eventId: number, id: number, isMainEvent: boolean): { event_id: number; id: number; is_main_event: boolean } {
  return { event_id: eventId, id, is_main_event: isMainEvent };
}
```

- [ ] **Step 2: Write the failing tests**

Append these tests at the end of `data/lib/event-utils.test.ts`:

```typescript
test('selectHeadlineFightPerEvent keeps the is_main_event fight for a given event_id', () => {
  const fights = [makeFight(1, 10, false), makeFight(1, 11, true), makeFight(1, 12, false)];

  const result = selectHeadlineFightPerEvent(fights);

  assert.deepEqual(
    result.map((f) => f.id),
    [11],
  );
});

test('selectHeadlineFightPerEvent falls back to the lowest id when no fight is flagged is_main_event', () => {
  const fights = [makeFight(1, 20, false), makeFight(1, 18, false), makeFight(1, 25, false)];

  const result = selectHeadlineFightPerEvent(fights);

  assert.deepEqual(
    result.map((f) => f.id),
    [18],
  );
});

test('selectHeadlineFightPerEvent picks the lowest id among multiple is_main_event fights for the same event', () => {
  const fights = [makeFight(1, 30, true), makeFight(1, 28, true)];

  const result = selectHeadlineFightPerEvent(fights);

  assert.deepEqual(
    result.map((f) => f.id),
    [28],
  );
});

test('selectHeadlineFightPerEvent keeps one entry per distinct event_id, in order of first appearance', () => {
  const fights = [makeFight(2, 40, true), makeFight(1, 10, true), makeFight(2, 41, false), makeFight(3, 50, true)];

  const result = selectHeadlineFightPerEvent(fights);

  assert.deepEqual(
    result.map((f) => f.event_id),
    [2, 1, 3],
  );
});

test('selectHeadlineFightPerEvent returns an empty array for empty input', () => {
  const result = selectHeadlineFightPerEvent([]);

  assert.deepEqual(result, []);
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx tsx --test data/lib/event-utils.test.ts`
Expected: FAIL — `selectHeadlineFightPerEvent` is not exported from `./event-utils` (module has no export named `selectHeadlineFightPerEvent`, or a TS error to that effect).

- [ ] **Step 4: Commit**

```bash
git add data/lib/event-utils.test.ts
git commit -m "test(home): add failing tests for selectHeadlineFightPerEvent

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: `selectHeadlineFightPerEvent` — implementation

**Files:**
- Modify: `data/lib/event-utils.ts`

- [ ] **Step 1: Add the function at the end of the file**

Append after the existing `prioritizeOrganization` function (end of file, currently line 178):

```typescript

/**
 * Reduces `items` to one entry per `event_id`: the one with `is_main_event`
 * true, or — when no row for that event is flagged (older events never got
 * `is_main_event` backfilled) — the one with the lowest `id`. When more than
 * one row for the same event is flagged `is_main_event` (a data-quality
 * fluke observed in the DB, e.g. a card with two "semifinal" main events),
 * picks the lowest `id` among those flagged rows, for a deterministic
 * result. This is the same "is_main_event, else lowest id" convention
 * `fetchFightsByEvent`'s `ORDER BY is_main_event DESC, id ASC` and
 * `splitMainEvent` already use elsewhere — see
 * docs/superpowers/specs/2026-09-04-home-recent-results-headline-fight-design.md.
 *
 * Preserves the order of each event_id's first appearance in `items` —
 * callers that already sort by event date should keep that ordering by
 * feeding this function pre-sorted input.
 */
export function selectHeadlineFightPerEvent<T extends { event_id: number; id: number; is_main_event: boolean }>(
  items: T[],
): T[] {
  const byEvent = new Map<number, T>();
  const eventOrder: number[] = [];

  for (const item of items) {
    const current = byEvent.get(item.event_id);
    if (!current) {
      byEvent.set(item.event_id, item);
      eventOrder.push(item.event_id);
      continue;
    }

    const currentIsBetter = current.is_main_event === item.is_main_event ? current.id < item.id : current.is_main_event;
    if (!currentIsBetter) {
      byEvent.set(item.event_id, item);
    }
  }

  return eventOrder.map((eventId) => byEvent.get(eventId)!);
}
```

- [ ] **Step 2: Run the tests to verify they pass**

Run: `npx tsx --test data/lib/event-utils.test.ts`
Expected: PASS — all tests in the file green, including the 5 added in Task 1.

- [ ] **Step 3: Commit**

```bash
git add data/lib/event-utils.ts
git commit -m "feat(home): add selectHeadlineFightPerEvent helper

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Wire into `fetchRecentFinishedFights`

**Files:**
- Modify: `data/lib/data.ts:12` (import)
- Modify: `data/lib/data.ts:469-474` (pool size + comment)
- Modify: `data/lib/data.ts:559` (pipeline)

- [ ] **Step 1: Import the new helper**

In `data/lib/data.ts`, change line 12 from:

```typescript
import { PRIORITY_ORGANIZATION_ABBREVIATION, prioritizeOrganization } from './event-utils';
```

to:

```typescript
import { PRIORITY_ORGANIZATION_ABBREVIATION, prioritizeOrganization, selectHeadlineFightPerEvent } from './event-utils';
```

- [ ] **Step 2: Widen the pool and update its comment**

In `fetchRecentFinishedFights`, change:

```typescript
    // Widened pool so prioritizeOrganization below has recent-but-not-UFC
    // results to compare against — see docs/superpowers/specs/2026-09-03-home-ufc-priority-design.md.
    const POOL_SIZE = 20;
    const poolLimit = Math.max(POOL_SIZE, limit);
```

to:

```typescript
    // Widened pool of raw fights (not events) so that, after
    // selectHeadlineFightPerEvent below collapses it to one fight per event,
    // enough distinct events survive — a single card can have a dozen-plus
    // finished fights, which would otherwise starve the reduction — while
    // still leaving prioritizeOrganization recent-but-not-UFC alternatives
    // to compare against. See
    // docs/superpowers/specs/2026-09-04-home-recent-results-headline-fight-design.md.
    const POOL_SIZE = 60;
    const poolLimit = Math.max(POOL_SIZE, limit);
```

- [ ] **Step 3: Reduce to one fight per event before the UFC-first sort**

Change the final line of `fetchRecentFinishedFights` from:

```typescript
    return prioritizeOrganization(mapped, PRIORITY_ORGANIZATION_ABBREVIATION).slice(0, limit);
```

to:

```typescript
    return prioritizeOrganization(selectHeadlineFightPerEvent(mapped), PRIORITY_ORGANIZATION_ABBREVIATION).slice(0, limit);
```

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: PASS — no regressions in any `data/**/*.test.ts` file.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors (confirms `mapped: FightResultWithContext[]` satisfies `selectHeadlineFightPerEvent`'s generic constraint `{ event_id: number; id: number; is_main_event: boolean }`).

- [ ] **Step 6: Commit**

```bash
git add data/lib/data.ts
git commit -m "feat(home): show one headline fight per event in Derniers résultats

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Manual verification on the running home page

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Use the `mma-universe-dev` preview config (`npm run dev`, port 3000) and open `http://localhost:3000`.

- [ ] **Step 2: Read the "Derniers résultats" section**

Read the page and check the "Derniers résultats" section:
- Confirm it shows at most one row per event (each row's event name — read via the fight result row's linked event — should be distinct across the 4 rows; no two rows from the same card).
- Confirm the first row is the most recent UFC event's fight, and cross-check against the DB that this fight is that event's `is_main_event` fight (or its lowest-`id` fight if the event has none flagged) — e.g. re-run the read-only verification query used during brainstorming:

```bash
node -e "
require('dotenv').config({path:'.env.local'});
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL, { fullResults: true });
(async () => {
  const r = await sql\`
    SELECT e.name AS event_name, e.date, o.abbreviation AS org, f.id, f.is_main_event
    FROM fights f
    JOIN events e ON f.event_id = e.id
    JOIN organizations o ON e.organization_id = o.id
    WHERE f.fight_finished = true AND o.abbreviation = 'UFC'
    ORDER BY e.date DESC, f.is_main_event DESC, f.id ASC
    LIMIT 5
  \`;
  for (const row of r.rows) console.log(row.date, row.event_name, '| id:', row.id, '| main:', row.is_main_event);
})().catch(e => { console.error(e); process.exit(1); });
"
```

The first row this prints for the most recent UFC event's date should match the fighters shown in "Derniers résultats"' first row on the page.

- [ ] **Step 3: Report findings**

If the section matches expectations, note that verification passed (no commit needed — this task is read-only). If it doesn't, treat it as a bug: re-open Task 3 rather than patching around it here.

---

## Self-Review Notes

- **Spec coverage:** `selectHeadlineFightPerEvent` (design §Design) → Tasks 1–2. Pipeline wiring + `POOL_SIZE` 20→60 (design §Design) → Task 3. Unit test cases listed in design §Tests → all five covered in Task 1. Manual browser verification (design §Tests) → Task 4. "Ce qui ne change pas" / "Hors périmètre" items require no tasks (nothing to build).
- **Type consistency:** `selectHeadlineFightPerEvent<T extends { event_id: number; id: number; is_main_event: boolean }>` in Task 2 matches the fields already present on `FightResultWithContext` (`data/lib/definitions.ts`), used unchanged as the `mapped` array's type in Task 3 — no adapter needed.
- **No placeholders:** every step above has literal code/commands to run, not descriptions.
