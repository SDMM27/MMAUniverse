# Pick'em / Pronostics — Backend + Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the pick'em/pronostics feature on web — pronostics par combat (vainqueur + méthode + round), verrouillage au démarrage de l'event, scoring, classement par event et all-time — avec comptes utilisateurs via Clerk.

**Architecture:** Next.js App Router (existing project) + Neon Postgres via `@neondatabase/serverless` (existing `sql` tagged-template client) + Clerk for auth (native Vercel Marketplace integration, chosen per `vercel:auth` skill guidance). Scoring is computed on read (no pre-computed scores table), reusing a single set of pure TypeScript functions shared between the leaderboard queries, the pick-history page, and the per-fight result display — never duplicated in SQL. A prerequisite fix to `sync-upcoming-to-db.ts` makes fight rows stable across syncs (upsert-in-place instead of delete+recreate) so `picks.fight_id` foreign keys survive routine result syncs.

**Tech Stack:** Next.js 14 (App Router), TypeScript, `@neondatabase/serverless`, Tailwind (existing Dark Combat tokens), Clerk (`@clerk/nextjs`), Node's built-in test runner via `tsx --test` (existing project convention — no Jest/Vitest).

**Spec:** `docs/superpowers/specs/2026-08-21-pickem-fantasy-design.md`

**Scope note:** This plan covers backend + web only. Mobile (Expo) is a separate follow-up plan once this lands — see the spec's Risks section. Automating the results sync pipeline (`rescrape-upcoming.ts` / `sync-upcoming-to-db.ts`) is explicitly out of scope (decided during planning — those scripts read/write local files and aren't serverless-safe as-is); picks score whenever a human re-runs the existing manual scripts, same as the rest of the site today.

---

## Task 1: Stable fight-sync diff (pure function)

**Files:**
- Create: `data/scrapers/shared/fight-sync.ts`
- Test: `data/scrapers/shared/fight-sync.test.ts`

**Why:** `sync-upcoming-to-db.ts` currently does `DELETE FROM fights WHERE event_id = ...` then re-`INSERT`s every fight for that event on every run, even when nothing changed. Once `picks.fight_id REFERENCES fights(id)` exists (Task 7), this either blocks the sync (FK violation) or — if the FK is `ON DELETE CASCADE` — silently wipes user picks on every sync. This task extracts the "what changed" decision into a pure, testable function; Task 2 wires it into the script.

- [x] **Step 1: Write the failing test**

```ts
// data/scrapers/shared/fight-sync.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planFightSync } from './fight-sync';

function freshFight(overrides: Partial<Parameters<typeof planFightSync>[1][number]> = {}) {
  return {
    fighter1_id: 1,
    fighter2_id: 2,
    fight_finished: false,
    winner_id: null,
    method: '',
    round: 0,
    time: '',
    weight_class: 'Lightweight',
    ...overrides,
  };
}

test('planFightSync matches an existing fight by fighter pair and marks it for update', () => {
  const existing = [{ id: 42, fighter1_id: 1, fighter2_id: 2 }];
  const fresh = [freshFight({ fight_finished: true, winner_id: 1, method: 'Decision (Unanimous)', round: 3 })];

  const plan = planFightSync(existing, fresh);

  assert.equal(plan.toUpdate.length, 1);
  assert.equal(plan.toUpdate[0].id, 42);
  assert.equal(plan.toUpdate[0].fight.winner_id, 1);
  assert.deepEqual(plan.toInsert, []);
  assert.deepEqual(plan.toDeleteIds, []);
});

test('planFightSync marks a fighter pair with no existing row for insert', () => {
  const existing: Parameters<typeof planFightSync>[0] = [];
  const fresh = [freshFight()];

  const plan = planFightSync(existing, fresh);

  assert.equal(plan.toUpdate.length, 0);
  assert.equal(plan.toInsert.length, 1);
  assert.deepEqual(plan.toDeleteIds, []);
});

test('planFightSync marks an existing row absent from the fresh set for deletion', () => {
  const existing = [{ id: 7, fighter1_id: 5, fighter2_id: 6 }];
  const fresh = [freshFight({ fighter1_id: 1, fighter2_id: 2 })];

  const plan = planFightSync(existing, fresh);

  assert.deepEqual(plan.toDeleteIds, [7]);
  assert.equal(plan.toInsert.length, 1);
});

test('planFightSync handles a full card unchanged run with zero updates needed as pure updates, not deletes', () => {
  const existing = [
    { id: 1, fighter1_id: 10, fighter2_id: 11 },
    { id: 2, fighter1_id: 20, fighter2_id: 21 },
  ];
  const fresh = [
    freshFight({ fighter1_id: 10, fighter2_id: 11 }),
    freshFight({ fighter1_id: 20, fighter2_id: 21 }),
  ];

  const plan = planFightSync(existing, fresh);

  assert.equal(plan.toUpdate.length, 2);
  assert.deepEqual(plan.toInsert, []);
  assert.deepEqual(plan.toDeleteIds, []);
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx tsx --test data/scrapers/shared/fight-sync.test.ts`
Expected: FAIL — `Cannot find module './fight-sync'`

- [x] **Step 3: Write the implementation**

```ts
// data/scrapers/shared/fight-sync.ts
//
// Decides how to reconcile a freshly-scraped card against the fight rows
// already in the DB for that event, matched by fighter pair rather than
// blind delete+recreate. This keeps `fights.id` stable across syncs so
// `picks.fight_id` foreign keys survive routine result syncs — see
// docs/superpowers/specs/2026-08-21-pickem-fantasy-design.md, "Risques".
export type ExistingFightRow = {
  id: number;
  fighter1_id: number;
  fighter2_id: number;
};

export type FreshFight = {
  fighter1_id: number;
  fighter2_id: number;
  fight_finished: boolean;
  winner_id: number | null;
  method: string;
  round: number;
  time: string;
  weight_class: string;
};

export type FightSyncPlan = {
  toUpdate: { id: number; fight: FreshFight }[];
  toInsert: FreshFight[];
  toDeleteIds: number[];
};

function fightKey(fighter1Id: number, fighter2Id: number): string {
  return `${fighter1Id}-${fighter2Id}`;
}

export function planFightSync(existing: ExistingFightRow[], fresh: FreshFight[]): FightSyncPlan {
  const existingByKey = new Map(existing.map((row) => [fightKey(row.fighter1_id, row.fighter2_id), row]));
  const freshKeys = new Set(fresh.map((f) => fightKey(f.fighter1_id, f.fighter2_id)));

  const toUpdate: FightSyncPlan['toUpdate'] = [];
  const toInsert: FreshFight[] = [];
  for (const fight of fresh) {
    const match = existingByKey.get(fightKey(fight.fighter1_id, fight.fighter2_id));
    if (match) {
      toUpdate.push({ id: match.id, fight });
    } else {
      toInsert.push(fight);
    }
  }

  const toDeleteIds = existing
    .filter((row) => !freshKeys.has(fightKey(row.fighter1_id, row.fighter2_id)))
    .map((row) => row.id);

  return { toUpdate, toInsert, toDeleteIds };
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx tsx --test data/scrapers/shared/fight-sync.test.ts`
Expected: PASS, 4 tests

- [x] **Step 5: Commit**

```bash
git add data/scrapers/shared/fight-sync.ts data/scrapers/shared/fight-sync.test.ts
git commit -m "feat(scrapers): add planFightSync pure diff for stable fight ids"
```

---

## Task 2: Wire `planFightSync` into `sync-upcoming-to-db.ts`

**Files:**
- Modify: `data/scrapers/sync-upcoming-to-db.ts`

- [x] **Step 1: Replace the per-event fight sync block**

In `data/scrapers/sync-upcoming-to-db.ts`, replace this block (currently around lines 110–139):

```ts
    for (const event of futureEvents) {
      const eventId = await upsertEvent(event, dataset.organization_id);
      const eventFights = dataset.fights.filter((f) => f.event_name === event.name);

      // Full replace: this event's card in the JSON is now authoritative.
      await sql`DELETE FROM fights WHERE event_id = ${eventId}`;

      for (const fight of eventFights) {
        const fighter1 = dataset.fighters.find((f) => f.name === fight.fighter1_name);
        const fighter2 = dataset.fighters.find((f) => f.name === fight.fighter2_name);
        if (!fighter1 || !fighter2) {
          console.warn(`  skipping fight "${fight.fighter1_name} vs ${fight.fighter2_name}" — fighter data missing`);
          continue;
        }
        const fighter1Id = await upsertFighter(fighter1, dataset.organization_id);
        const fighter2Id = await upsertFighter(fighter2, dataset.organization_id);
        const winnerId = fight.winner_name
          ? await upsertFighter(
              dataset.fighters.find((f) => f.name === fight.winner_name) ?? { name: fight.winner_name, image_url: '', weight_class: '', record: '', ranking: 0 },
              dataset.organization_id,
            )
          : null;

        await sql`
          INSERT INTO fights (event_id, fighter1_id, fighter2_id, fight_finished, winner_id, method, round, time, weight_class)
          VALUES (${eventId}, ${fighter1Id}, ${fighter2Id}, ${fight.fight_finished}, ${winnerId}, ${fight.method}, ${fight.round}, ${fight.time}, ${fight.weight_class})
        `;
      }

      console.log(`  synced "${event.name}" -> ${eventFights.length} fight(s)`);
    }
```

with:

```ts
    for (const event of futureEvents) {
      const eventId = await upsertEvent(event, dataset.organization_id);
      const eventFights = dataset.fights.filter((f) => f.event_name === event.name);

      const freshFights: FreshFight[] = [];
      for (const fight of eventFights) {
        const fighter1 = dataset.fighters.find((f) => f.name === fight.fighter1_name);
        const fighter2 = dataset.fighters.find((f) => f.name === fight.fighter2_name);
        if (!fighter1 || !fighter2) {
          console.warn(`  skipping fight "${fight.fighter1_name} vs ${fight.fighter2_name}" — fighter data missing`);
          continue;
        }
        const fighter1Id = await upsertFighter(fighter1, dataset.organization_id);
        const fighter2Id = await upsertFighter(fighter2, dataset.organization_id);
        const winnerId = fight.winner_name
          ? await upsertFighter(
              dataset.fighters.find((f) => f.name === fight.winner_name) ?? { name: fight.winner_name, image_url: '', weight_class: '', record: '', ranking: 0 },
              dataset.organization_id,
            )
          : null;

        freshFights.push({
          fighter1_id: fighter1Id,
          fighter2_id: fighter2Id,
          fight_finished: fight.fight_finished,
          winner_id: winnerId,
          method: fight.method,
          round: fight.round,
          time: fight.time,
          weight_class: fight.weight_class,
        });
      }

      const existingRows = await sql<{ id: number; fighter1_id: number; fighter2_id: number }>`
        SELECT id, fighter1_id, fighter2_id FROM fights WHERE event_id = ${eventId}
      `;
      const plan = planFightSync(existingRows.rows, freshFights);

      for (const { id, fight } of plan.toUpdate) {
        await sql`
          UPDATE fights SET fight_finished = ${fight.fight_finished}, winner_id = ${fight.winner_id},
            method = ${fight.method}, round = ${fight.round}, time = ${fight.time}, weight_class = ${fight.weight_class}
          WHERE id = ${id}
        `;
      }
      for (const fight of plan.toInsert) {
        await sql`
          INSERT INTO fights (event_id, fighter1_id, fighter2_id, fight_finished, winner_id, method, round, time, weight_class)
          VALUES (${eventId}, ${fight.fighter1_id}, ${fight.fighter2_id}, ${fight.fight_finished}, ${fight.winner_id}, ${fight.method}, ${fight.round}, ${fight.time}, ${fight.weight_class})
        `;
      }
      // A fight genuinely pulled from the card (not just unchanged) is deleted here.
      // picks.fight_id is ON DELETE CASCADE (Task 7) so any picks on it are removed
      // along with it — consistent with the spec's "traité comme si ce combat n'avait
      // jamais existé" rule for withdrawn fights.
      for (const id of plan.toDeleteIds) {
        await sql`DELETE FROM fights WHERE id = ${id}`;
      }

      console.log(
        `  synced "${event.name}" -> ${plan.toUpdate.length} updated, ${plan.toInsert.length} new, ${plan.toDeleteIds.length} removed`,
      );
    }
```

- [x] **Step 2: Add the import**

At the top of `data/scrapers/sync-upcoming-to-db.ts`, add:

```ts
import { planFightSync, type FreshFight } from './shared/fight-sync';
```

- [x] **Step 3: Manual verification — fight ids stay stable across two runs**

Run: `npx tsx data/scrapers/sync-upcoming-to-db.ts`
Then note an `id` from `SELECT id, fighter1_id, fighter2_id FROM fights WHERE event_id = <any synced event id>` (via `/seed`-adjacent DB access or a one-off query).
Run the sync script again with no data changes: `npx tsx data/scrapers/sync-upcoming-to-db.ts`
Expected: same `fights.id` values as before (log line shows `0 updated → still N updated` — i.e. rows matched and UPDATEd in place, not `N new`).

- [x] **Step 4: Commit**

```bash
git add data/scrapers/sync-upcoming-to-db.ts
git commit -m "fix(scrapers): upsert fights in place during sync instead of delete+recreate"
```

---

## Task 3: `normalizeStartTime` (capture full event start time)

**Files:**
- Modify: `data/scrapers/shared/normalize-date.ts`
- Modify: `data/scrapers/shared/normalize-date.test.ts`

**Why:** `events.date` is date-only (`YYYY-MM-DD`); the pick lock (Task 11) needs the actual kickoff time. Sherdog's `startDate` meta tag already carries the full ISO 8601 datetime — `normalizeDate` currently throws away everything but the date part. This adds a sibling function that keeps the full value, without changing `normalizeDate`'s existing contract (still used for date-only comparisons elsewhere, e.g. `sync-upcoming-to-db.ts`'s `date >= today` filter).

- [x] **Step 1: Write the failing tests**

Append to `data/scrapers/shared/normalize-date.test.ts`:

```ts
import { normalizeStartTime } from './normalize-date';

test('normalizeStartTime passes through a valid Sherdog ISO datetime', () => {
  assert.equal(normalizeStartTime('2013-09-20T00:00:00+00:00'), '2013-09-20T00:00:00+00:00');
});

test('normalizeStartTime trims surrounding whitespace', () => {
  assert.equal(normalizeStartTime('  2026-08-22T22:00:00-04:00  '), '2026-08-22T22:00:00-04:00');
});

test('normalizeStartTime throws on an unrecognized format', () => {
  assert.throws(() => normalizeStartTime('not a date'), /Unrecognized Sherdog start time format/);
});

test('normalizeStartTime throws on an empty string', () => {
  assert.throws(() => normalizeStartTime(''), /Unrecognized Sherdog start time format/);
});
```

(Add the `normalizeStartTime` import to the existing `import { normalizeDate } from './normalize-date';` line instead of a duplicate import line.)

- [x] **Step 2: Run test to verify it fails**

Run: `npx tsx --test data/scrapers/shared/normalize-date.test.ts`
Expected: FAIL — `normalizeStartTime is not a function` / not exported

- [x] **Step 3: Write the implementation**

Append to `data/scrapers/shared/normalize-date.ts`:

```ts
/**
 * Like `normalizeDate`, but keeps the full ISO 8601 datetime instead of just
 * the date portion — used for `events.start_time`, which needs the actual
 * kickoff time to lock picks accurately (see the pick'em design doc).
 */
export function normalizeStartTime(sherdogStartDate: string): string {
  const trimmed = sherdogStartDate.trim();
  if (!trimmed || Number.isNaN(Date.parse(trimmed))) {
    throw new Error(`Unrecognized Sherdog start time format: "${sherdogStartDate}"`);
  }
  return trimmed;
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx tsx --test data/scrapers/shared/normalize-date.test.ts`
Expected: PASS, all tests (existing `normalizeDate` tests + new `normalizeStartTime` tests)

- [x] **Step 5: Commit**

```bash
git add data/scrapers/shared/normalize-date.ts data/scrapers/shared/normalize-date.test.ts
git commit -m "feat(scrapers): add normalizeStartTime alongside normalizeDate"
```

---

## Task 4: Capture `start_time` through the parser

**Files:**
- Modify: `data/scrapers/parse.ts`
- Modify: `data/scrapers/parse.test.ts`

- [x] **Step 1: Update the failing test expectation**

In `data/scrapers/parse.test.ts`, in the `'parseEventDetails extracts event metadata and all fights from a finished event'` test, add after the existing `assert.equal(details.date, '2013-09-20');` line:

```ts
  assert.equal(details.start_time, '2013-09-20T00:00:00+00:00');
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx tsx --test data/scrapers/parse.test.ts`
Expected: FAIL — `details.start_time` is `undefined`

- [x] **Step 3: Update the types and implementation**

In `data/scrapers/parse.ts`, update the import:

```ts
import { normalizeDate, normalizeStartTime } from './shared/normalize-date';
```

Update the `ParsedEventDetails` interface:

```ts
export interface ParsedEventDetails {
  name: string;
  date: string;
  start_time: string;
  location: string;
  poster: string;
  fights: ParsedFight[];
}
```

In `parseEventDetails`, after the existing `const date = normalizeDate(dateContent);` line, add:

```ts
  const start_time = normalizeStartTime(dateContent);
```

And update the return statement at the end of `parseEventDetails` from:

```ts
  return { name, date, location, poster, fights };
```

to:

```ts
  return { name, date, start_time, location, poster, fights };
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx tsx --test data/scrapers/parse.test.ts`
Expected: PASS, all tests

- [x] **Step 5: Commit**

```bash
git add data/scrapers/parse.ts data/scrapers/parse.test.ts
git commit -m "feat(scrapers): capture start_time in parseEventDetails"
```

---

## Task 5: Thread `start_time` through the scraped-data pipeline

**Files:**
- Modify: `data/scrapers/shared/types.ts`
- Modify: `data/scrapers/sherdog.ts`
- Modify: `data/scrapers/rescrape-upcoming.ts`

**Why:** `parseEventDetails` now returns `start_time`, but it still needs to flow into `ScrapedEvent` (the shape written to `data/scraped/*.json`) at both call sites that build events from parsed details.

- [x] **Step 1: Add the field to `ScrapedEvent`**

In `data/scrapers/shared/types.ts`, update:

```ts
export interface ScrapedEvent {
  name: string;
  date: string; // ISO 'YYYY-MM-DD'
  start_time: string; // full ISO 8601 datetime
  event_location: string;
  event_poster: string;
}
```

- [x] **Step 2: Wire it in `sherdog.ts`**

In `data/scrapers/sherdog.ts`, update the `progress.data.events.push(...)` call (around line 54):

```ts
    progress.data.events.push({
      name: details.name,
      date: details.date,
      start_time: details.start_time,
      event_location: details.location,
      event_poster: details.poster,
    });
```

- [x] **Step 3: Wire it in `rescrape-upcoming.ts`**

In `data/scrapers/rescrape-upcoming.ts`, update the `freshEvents.push(...)` call (around line 48):

```ts
      freshEvents.push({
        name: details.name,
        date: details.date,
        start_time: details.start_time,
        event_location: details.location,
        event_poster: details.poster,
      });
```

- [x] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors (both call sites now satisfy the `ScrapedEvent` shape)

- [x] **Step 5: Commit**

```bash
git add data/scrapers/shared/types.ts data/scrapers/sherdog.ts data/scrapers/rescrape-upcoming.ts
git commit -m "feat(scrapers): thread start_time through ScrapedEvent"
```

---

## Task 6: Persist `start_time` to the DB

**Files:**
- Modify: `data/lib/definitions.ts`
- Modify: `app/seed/route.ts`
- Modify: `data/scrapers/sync-upcoming-to-db.ts`

- [x] **Step 1: Add the field to the `Event` type**

In `data/lib/definitions.ts`, update:

```ts
export type Event = {
    id: number;
    name: string;
    date: string;
    start_time: string | null;
    event_location: string;
    event_poster: string;
    organization_id: number;
  };
```

- [x] **Step 2: Add the column and backfill it on seed**

In `app/seed/route.ts`, inside `seedEvents()`, after the existing `CREATE TABLE IF NOT EXISTS events (...)` block, add:

```ts
  await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ;`;
```

And update the insert loop from:

```ts
      const result = await sql`
        INSERT INTO events (name, date, event_location, event_poster, organization_id)
        VALUES (${event.name}, ${event.date}, ${event.event_location}, ${event.event_poster}, ${dataset.organization_id})
        ON CONFLICT (id) DO NOTHING;
      `;
```

to:

```ts
      const result = await sql`
        INSERT INTO events (name, date, start_time, event_location, event_poster, organization_id)
        VALUES (${event.name}, ${event.date}, ${(event as { start_time?: string }).start_time ?? null}, ${event.event_location}, ${event.event_poster}, ${dataset.organization_id})
        ON CONFLICT (id) DO NOTHING;
      `;
```

(The `as { start_time?: string }` cast is because `data/scraped/*.json` on disk may predate this field until someone re-runs the scraper — `seedEvents()` must tolerate rows without it rather than crash.)

- [x] **Step 3: Set it during incremental sync**

In `data/scrapers/sync-upcoming-to-db.ts`, update `upsertEvent`'s signature and body from:

```ts
async function upsertEvent(event: { name: string; date: string; event_location: string; event_poster: string }, organizationId: number) {
  const existing = await sql`SELECT id FROM events WHERE name = ${event.name}`;
  if (existing.length > 0) {
    const id = existing[0].id;
    await sql`
      UPDATE events SET date = ${event.date}, event_location = ${event.event_location},
        event_poster = ${event.event_poster}, organization_id = ${organizationId}
      WHERE id = ${id}
    `;
    return id;
  }
  const inserted = await sql`
    INSERT INTO events (name, date, event_location, event_poster, organization_id)
    VALUES (${event.name}, ${event.date}, ${event.event_location}, ${event.event_poster}, ${organizationId})
    RETURNING id
  `;
  return inserted[0].id;
}
```

to:

```ts
async function upsertEvent(
  event: { name: string; date: string; start_time: string; event_location: string; event_poster: string },
  organizationId: number,
) {
  const existing = await sql`SELECT id FROM events WHERE name = ${event.name}`;
  if (existing.length > 0) {
    const id = existing[0].id;
    await sql`
      UPDATE events SET date = ${event.date}, start_time = ${event.start_time}, event_location = ${event.event_location},
        event_poster = ${event.event_poster}, organization_id = ${organizationId}
      WHERE id = ${id}
    `;
    return id;
  }
  const inserted = await sql`
    INSERT INTO events (name, date, start_time, event_location, event_poster, organization_id)
    VALUES (${event.name}, ${event.date}, ${event.start_time}, ${event.event_location}, ${event.event_poster}, ${organizationId})
    RETURNING id
  `;
  return inserted[0].id;
}
```

- [x] **Step 4: Manual verification**

Run: `curl -s <local-dev-url>/seed` (with the dev server running) to apply the `ALTER TABLE`.
Then query `SELECT name, date, start_time FROM events LIMIT 5` (e.g. via the Neon console) — `start_time` is `NULL` for pre-existing rows (expected, since `data/scraped/*.json` hasn't been re-scraped) and column exists without error.
Run `npx tsx data/scrapers/rescrape-upcoming.ts ufc` then `npx tsx data/scrapers/sync-upcoming-to-db.ts` — confirm at least one UFC upcoming event now has a non-null `start_time`.

- [x] **Step 5: Commit**

```bash
git add data/lib/definitions.ts app/seed/route.ts data/scrapers/sync-upcoming-to-db.ts
git commit -m "feat(db): add events.start_time column, populated by seed and sync"
```

---

## Task 7: `users` and `picks` schema

**Files:**
- Modify: `app/seed/route.ts`

- [x] **Step 1: Add the schema function**

In `app/seed/route.ts`, add a new function (after `seedFights`, before `GET`):

```ts
async function seedPickemSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      external_auth_id TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS picks (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id),
      fight_id BIGINT NOT NULL REFERENCES fights(id) ON DELETE CASCADE,
      predicted_winner_id BIGINT NOT NULL REFERENCES fighters(id),
      predicted_method_category TEXT NOT NULL CHECK (predicted_method_category IN ('ko_tko', 'submission', 'decision')),
      predicted_round SMALLINT CHECK (predicted_round IS NULL OR predicted_round BETWEEN 1 AND 5),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (user_id, fight_id)
    );
  `;
}
```

`fight_id` is `ON DELETE CASCADE`: when a fight is genuinely withdrawn from a card (Task 2's `toDeleteIds` path), its picks are removed along with it — matching the spec's rule that a withdrawn fight is excluded from scoring "comme s'il n'avait jamais existé". This never fires for unchanged fights any more, since Task 2 upserts those in place.

- [x] **Step 2: Call it from `GET`**

In `app/seed/route.ts`, update the `GET` handler from:

```ts
export async function GET() {
  try {
    await seedOrganizations(); // Cette fonction doit être exécutée en premier
    await seedEvents();        // Dépend de `organizations`
    await seedFighters();      // Peut dépendre de `organizations`
    await seedFights();        // Dépend de `events` et `fighters`

    return Response.json({ message: 'Database seeded successfully' });
  } catch (error) {
    console.error(error);  // Pour un meilleur débogage
    return Response.json({ error }, { status: 500 });
  }
}
```

to:

```ts
export async function GET() {
  try {
    await seedOrganizations(); // Cette fonction doit être exécutée en premier
    await seedEvents();        // Dépend de `organizations`
    await seedFighters();      // Peut dépendre de `organizations`
    await seedFights();        // Dépend de `events` et `fighters`
    await seedPickemSchema();  // Dépend de `fighters` (predicted_winner_id FK)

    return Response.json({ message: 'Database seeded successfully' });
  } catch (error) {
    console.error(error);  // Pour un meilleur débogage
    return Response.json({ error }, { status: 500 });
  }
}
```

- [x] **Step 3: Manual verification**

Run: `curl -s <local-dev-url>/seed`
Expected: `{"message":"Database seeded successfully"}`. Query `\d users` and `\d picks` (or the Neon console table view) — both tables exist with the columns above.

- [x] **Step 4: Commit**

```bash
git add app/seed/route.ts
git commit -m "feat(db): add users and picks tables"
```

---

## Task 8: `Pick` and `PickemUser` types

**Files:**
- Modify: `data/lib/definitions.ts`

- [x] **Step 1: Add the types**

In `data/lib/definitions.ts`, add:

```ts
export type MethodCategory = 'ko_tko' | 'submission' | 'decision';

export type PickemUser = {
  id: number;
  external_auth_id: string;
  display_name: string;
  created_at: string;
};

export type Pick = {
  id: number;
  user_id: number;
  fight_id: number;
  predicted_winner_id: number;
  predicted_method_category: MethodCategory;
  predicted_round: number | null;
  created_at: string;
  updated_at: string;
};
```

- [x] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [x] **Step 3: Commit**

```bash
git add data/lib/definitions.ts
git commit -m "feat(types): add Pick and PickemUser"
```

---

## Task 9: `normalizeMethodCategory` (pure function)

**Files:**
- Create: `data/lib/method-category.ts`
- Test: `data/lib/method-category.test.ts`

**Why:** `fights.method` is free-text scraped from Sherdog (321 distinct values seen across the current scraped datasets, e.g. `"TKO (Doctor Stoppage)"`, `"Submission (Rear-Naked Choke)"`, even a scraper typo `"Submision (Arm-Triangle Choke)"`). Picks only ever predict one of three categories; this maps the real-world text onto those three (plus a catch-all `'other'` for methods no one can predict, e.g. `"Disqualification (...)"`, `"No Contest"`, `"Draw (...)"` — a fight scored via `scorePick`, Task 10, never reaches the method comparison for those anyway, since `winner_id` is null).

- [x] **Step 1: Write the failing tests**

```ts
// data/lib/method-category.test.ts
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
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx tsx --test data/lib/method-category.test.ts`
Expected: FAIL — `Cannot find module './method-category'`

- [x] **Step 3: Write the implementation**

```ts
// data/lib/method-category.ts
import type { MethodCategory } from './definitions';

/**
 * Maps free-text Sherdog method strings (e.g. "TKO (Doctor Stoppage)",
 * "Submission (Rear-Naked Choke)") onto the three categories the pick'em
 * lets a user predict. Methods no one can meaningfully predict (DQ, no
 * contest, draw) map to 'other' — scorePick (data/lib/scoring.ts) never
 * reaches the method comparison for those, since they have no winner_id.
 */
export function normalizeMethodCategory(method: string): MethodCategory | 'other' {
  const normalized = method.trim().toLowerCase();
  if (normalized.startsWith('ko') || normalized.startsWith('tko')) return 'ko_tko';
  if (normalized.startsWith('submission') || normalized.startsWith('submision') || normalized.startsWith('technical submission')) {
    return 'submission';
  }
  if (normalized.startsWith('decision') || normalized.startsWith('technical decision')) return 'decision';
  return 'other';
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx tsx --test data/lib/method-category.test.ts`
Expected: PASS, all tests

- [x] **Step 5: Commit**

```bash
git add data/lib/method-category.ts data/lib/method-category.test.ts
git commit -m "feat(picks): add normalizeMethodCategory"
```

---

## Task 10: `scorePick` (pure scoring function)

**Files:**
- Create: `data/lib/scoring.ts`
- Test: `data/lib/scoring.test.ts`

- [x] **Step 1: Write the failing tests**

```ts
// data/lib/scoring.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scorePick } from './scoring';

test('scorePick awards 20 points for a fully correct pick (winner + method + round)', () => {
  const points = scorePick(
    { predicted_winner_id: 1, predicted_method_category: 'submission', predicted_round: 2 },
    { winner_id: 1, method: 'Submission (Rear-Naked Choke)', round: 2 },
  );
  assert.equal(points, 20);
});

test('scorePick awards 15 points for winner + method correct, round wrong', () => {
  const points = scorePick(
    { predicted_winner_id: 1, predicted_method_category: 'ko_tko', predicted_round: 1 },
    { winner_id: 1, method: 'TKO (Punches)', round: 3 },
  );
  assert.equal(points, 15);
});

test('scorePick awards 10 points for winner correct, method wrong', () => {
  const points = scorePick(
    { predicted_winner_id: 1, predicted_method_category: 'decision', predicted_round: null },
    { winner_id: 1, method: 'TKO (Punches)', round: 2 },
  );
  assert.equal(points, 10);
});

test('scorePick awards 0 points when the predicted winner is wrong, even if method matches', () => {
  const points = scorePick(
    { predicted_winner_id: 2, predicted_method_category: 'decision', predicted_round: null },
    { winner_id: 1, method: 'Decision (Unanimous)', round: 3 },
  );
  assert.equal(points, 0);
});

test('scorePick never awards a round bonus for a decision, even if predicted_round happens to equal the actual round', () => {
  const points = scorePick(
    { predicted_winner_id: 1, predicted_method_category: 'decision', predicted_round: 3 },
    { winner_id: 1, method: 'Decision (Unanimous)', round: 3 },
  );
  assert.equal(points, 15); // winner + method, no round bonus for decisions
});

test('scorePick awards 0 points for a draw/no-contest, regardless of pick', () => {
  const points = scorePick(
    { predicted_winner_id: 1, predicted_method_category: 'ko_tko', predicted_round: 1 },
    { winner_id: null, method: 'No Contest', round: 0 },
  );
  assert.equal(points, 0);
});

test('scorePick awards only the winner bonus when the real method is unpredictable (e.g. disqualification)', () => {
  const points = scorePick(
    { predicted_winner_id: 1, predicted_method_category: 'ko_tko', predicted_round: 1 },
    { winner_id: 1, method: 'Disqualification (Illegal Elbow)', round: 2 },
  );
  assert.equal(points, 10);
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx tsx --test data/lib/scoring.test.ts`
Expected: FAIL — `Cannot find module './scoring'`

- [x] **Step 3: Write the implementation**

```ts
// data/lib/scoring.ts
import type { MethodCategory } from './definitions';
import { normalizeMethodCategory } from './method-category';

export type PickInput = {
  predicted_winner_id: number;
  predicted_method_category: MethodCategory;
  predicted_round: number | null;
};

export type FightResult = {
  winner_id: number | null;
  method: string;
  round: number;
};

/**
 * +10 for the right winner, +5 more if the method category also matches,
 * +5 more if the round also matches (only possible when the method isn't
 * a decision). A draw/no-contest (winner_id === null) always scores 0 —
 * it was never an option the pick UI offered. See the pick'em design doc's
 * "Scoring" section for the full rule table.
 */
export function scorePick(pick: PickInput, result: FightResult): number {
  if (result.winner_id === null) return 0;
  if (pick.predicted_winner_id !== result.winner_id) return 0;

  let points = 10;
  const actualCategory = normalizeMethodCategory(result.method);
  if (pick.predicted_method_category === actualCategory) {
    points += 5;
    if (actualCategory !== 'decision' && pick.predicted_round === result.round) {
      points += 5;
    }
  }
  return points;
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx tsx --test data/lib/scoring.test.ts`
Expected: PASS, all 7 tests

- [x] **Step 5: Commit**

```bash
git add data/lib/scoring.ts data/lib/scoring.test.ts
git commit -m "feat(picks): add scorePick"
```

---

## Task 11: `isEventLocked` (pure lock-window function)

**Files:**
- Create: `data/lib/pick-lock.ts`
- Test: `data/lib/pick-lock.test.ts`

- [x] **Step 1: Write the failing tests**

```ts
// data/lib/pick-lock.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isEventLocked } from './pick-lock';

test('isEventLocked is false before start_time', () => {
  const locked = isEventLocked({ start_time: '2026-08-22T22:00:00Z', date: '2026-08-22' }, new Date('2026-08-22T21:59:59Z'));
  assert.equal(locked, false);
});

test('isEventLocked is true at exactly start_time', () => {
  const locked = isEventLocked({ start_time: '2026-08-22T22:00:00Z', date: '2026-08-22' }, new Date('2026-08-22T22:00:00Z'));
  assert.equal(locked, true);
});

test('isEventLocked is true after start_time', () => {
  const locked = isEventLocked({ start_time: '2026-08-22T22:00:00Z', date: '2026-08-22' }, new Date('2026-08-23T01:00:00Z'));
  assert.equal(locked, true);
});

test('isEventLocked falls back to 00:00 UTC on `date` when start_time is null', () => {
  const notYetLocked = isEventLocked({ start_time: null, date: '2026-08-22' }, new Date('2026-08-21T23:59:59Z'));
  const locked = isEventLocked({ start_time: null, date: '2026-08-22' }, new Date('2026-08-22T00:00:00Z'));
  assert.equal(notYetLocked, false);
  assert.equal(locked, true);
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx tsx --test data/lib/pick-lock.test.ts`
Expected: FAIL — `Cannot find module './pick-lock'`

- [x] **Step 3: Write the implementation**

```ts
// data/lib/pick-lock.ts

/**
 * An event locks (no more picks accepted) at its known start_time, or —
 * for events scraped before that column existed — at 00:00 UTC on its date
 * as a conservative fallback. See the pick'em design doc's "Fenêtre de pick
 * & verrouillage" section.
 */
export function isEventLocked(event: { start_time: string | null; date: string }, now: Date): boolean {
  const lockAt = event.start_time ? new Date(event.start_time) : new Date(`${event.date}T00:00:00Z`);
  return now.getTime() >= lockAt.getTime();
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx tsx --test data/lib/pick-lock.test.ts`
Expected: PASS, all 4 tests

- [x] **Step 5: Commit**

```bash
git add data/lib/pick-lock.ts data/lib/pick-lock.test.ts
git commit -m "feat(picks): add isEventLocked"
```

---

## Task 12: Install and configure Clerk

**Files:**
- Create: `middleware.ts`
- Create: `app/sign-in/[[...sign-in]]/page.tsx`
- Create: `app/sign-up/[[...sign-up]]/page.tsx`
- Modify: `app/layout.tsx`
- Modify: `.env.local` (not committed)
- Modify: `package.json`

- [x] **Step 1: Install Clerk via the Vercel Marketplace**

Run: `vercel link` (if this project isn't linked to a Vercel project yet — follow the prompts)
Run: `vercel integration add clerk --yes`

This needs the user's Vercel account / a dashboard step to finish connecting the Clerk account (native Marketplace integration, not fully CLI-driven) — **stop here and ask the user to complete that step** before continuing. It auto-provisions `CLERK_SECRET_KEY` and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`.

- [x] **Step 2: Pull the provisioned env vars**

Run: `vercel env pull --yes`
Expected: `.env.local` now contains `CLERK_SECRET_KEY` and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`

- [x] **Step 3: Install the SDK**

Run: `npm install @clerk/nextjs`

- [x] **Step 4: Add middleware**

```ts
// middleware.ts
import { clerkMiddleware } from '@clerk/nextjs/server';

export default clerkMiddleware();

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
```

- [x] **Step 5: Wrap the root layout**

In `app/layout.tsx`, update:

```tsx
import type { Metadata } from "next";
import { inter, oswald } from "@/components/ui/fonts";
import Nav from "@/components/ui/nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "MMA Universe",
  description: "Organisations, events, fights et combattants MMA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={`${inter.className} ${oswald.variable} bg-base-bg text-ink-primary`}>
        <Nav />
        {children}
      </body>
    </html>
  );
}
```

to:

```tsx
import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { inter, oswald } from "@/components/ui/fonts";
import Nav from "@/components/ui/nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "MMA Universe",
  description: "Organisations, events, fights et combattants MMA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="fr">
        <body className={`${inter.className} ${oswald.variable} bg-base-bg text-ink-primary`}>
          <Nav />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
```

- [x] **Step 6: Add sign-in and sign-up pages**

```tsx
// app/sign-in/[[...sign-in]]/page.tsx
import { SignIn } from '@clerk/nextjs';

export default function Page() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <SignIn />
    </main>
  );
}
```

```tsx
// app/sign-up/[[...sign-up]]/page.tsx
import { SignUp } from '@clerk/nextjs';

export default function Page() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <SignUp />
    </main>
  );
}
```

- [x] **Step 7: Add routing env vars**

Append to `.env.local`:

```env
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
```

- [x] **Step 8: Manual verification**

Run: `npm run dev`, open `/sign-up`, create an account, confirm redirect and that the app renders without errors.
Open `/sign-in` in a private window, sign in with the same account, confirm it succeeds.

- [x] **Step 9: Commit**

```bash
git add middleware.ts app/layout.tsx "app/sign-in" "app/sign-up" package.json package-lock.json
git commit -m "feat(auth): install and configure Clerk"
```

---

## Task 13: Nav shows signed-in state

**Files:**
- Modify: `components/ui/nav.tsx`

- [x] **Step 1: Update the implementation**

In `components/ui/nav.tsx`, update:

```tsx
import Link from 'next/link';
import MMAUniverseLogo from '@/components/ui/mma-universe-logo';

const links = [
  { href: '/', label: 'Home' },
  { href: '/events', label: 'Events' },
  { href: '/fighters', label: 'Fighters' },
  { href: '/organizations', label: 'Organisations' },
];

export default function Nav() {
  return (
    <nav className="flex items-center justify-between gap-4 border-b border-base-border bg-base-bg px-6 py-4">
      <Link href="/" className="shrink-0">
        <MMAUniverseLogo />
      </Link>
      <ul className="flex gap-6">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="font-display text-sm uppercase tracking-wide text-ink-secondary hover:text-accent"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
```

to:

```tsx
import Link from 'next/link';
import { SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import MMAUniverseLogo from '@/components/ui/mma-universe-logo';

const links = [
  { href: '/', label: 'Home' },
  { href: '/events', label: 'Events' },
  { href: '/fighters', label: 'Fighters' },
  { href: '/organizations', label: 'Organisations' },
  { href: '/classement', label: 'Classement' },
];

export default function Nav() {
  return (
    <nav className="flex items-center justify-between gap-4 border-b border-base-border bg-base-bg px-6 py-4">
      <Link href="/" className="shrink-0">
        <MMAUniverseLogo />
      </Link>
      <ul className="flex items-center gap-6">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="font-display text-sm uppercase tracking-wide text-ink-secondary hover:text-accent"
            >
              {link.label}
            </Link>
          </li>
        ))}
        <li>
          <SignedIn>
            <Link
              href="/mes-pronostics"
              className="font-display text-sm uppercase tracking-wide text-ink-secondary hover:text-accent"
            >
              Mes pronostics
            </Link>
          </SignedIn>
        </li>
        <li className="flex items-center">
          <SignedOut>
            <Link
              href="/sign-in"
              className="font-display text-sm uppercase tracking-wide text-accent"
            >
              Connexion
            </Link>
          </SignedOut>
          <SignedIn>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
        </li>
      </ul>
    </nav>
  );
}
```

- [x] **Step 2: Manual verification**

Run: `npm run dev`. Signed out: nav shows "Connexion". Sign in: nav shows "Mes pronostics" and the Clerk user avatar/menu instead.

- [x] **Step 3: Commit**

```bash
git add components/ui/nav.tsx
git commit -m "feat(nav): show signed-in state and pronostics links"
```

---

## Task 14: `picks-data.ts` — persistence and read functions

**Files:**
- Create: `data/lib/picks-data.ts`

**Why:** Follows the existing `data/lib/data.ts` convention (try/catch, throw a descriptive `Error`, one function per query) rather than a new pattern. No automated test — this project has no DB test harness (`data/lib/data.ts` itself has none either); verified manually in Tasks 15/17/18/19.

- [x] **Step 1: Write the implementation**

```ts
// data/lib/picks-data.ts
import { currentUser } from '@clerk/nextjs/server';
import { sql } from '@/data/lib/db';
import { scorePick } from '@/data/lib/scoring';
import type { MethodCategory } from '@/data/lib/definitions';

export async function getOrCreateUser(externalAuthId: string, displayName: string): Promise<number> {
  try {
    const inserted = await sql<{ id: number }>`
      INSERT INTO users (external_auth_id, display_name)
      VALUES (${externalAuthId}, ${displayName})
      ON CONFLICT (external_auth_id) DO UPDATE SET display_name = EXCLUDED.display_name
      RETURNING id
    `;
    return inserted.rows[0].id;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to get or create user.');
  }
}

/** Resolves the signed-in Clerk user (if any) to this app's internal users.id. */
export async function getOrCreateCurrentUser(): Promise<number | null> {
  const user = await currentUser();
  if (!user) return null;
  const displayName = user.username ?? user.firstName ?? 'Pronostiqueur';
  return getOrCreateUser(user.id, displayName);
}

export type SubmitPickInput = {
  userId: number;
  fightId: number;
  predictedWinnerId: number;
  predictedMethodCategory: MethodCategory;
  predictedRound: number | null;
};

export async function upsertPick(input: SubmitPickInput): Promise<void> {
  try {
    await sql`
      INSERT INTO picks (user_id, fight_id, predicted_winner_id, predicted_method_category, predicted_round, updated_at)
      VALUES (${input.userId}, ${input.fightId}, ${input.predictedWinnerId}, ${input.predictedMethodCategory}, ${input.predictedRound}, now())
      ON CONFLICT (user_id, fight_id) DO UPDATE SET
        predicted_winner_id = EXCLUDED.predicted_winner_id,
        predicted_method_category = EXCLUDED.predicted_method_category,
        predicted_round = EXCLUDED.predicted_round,
        updated_at = now()
    `;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to save pick.');
  }
}

export type StoredPick = {
  predicted_winner_id: number;
  predicted_method_category: MethodCategory;
  predicted_round: number | null;
};

export async function fetchPicksForEvent(userId: number, eventId: string): Promise<Map<number, StoredPick>> {
  try {
    const rows = await sql<{ fight_id: number } & StoredPick>`
      SELECT p.fight_id, p.predicted_winner_id, p.predicted_method_category, p.predicted_round
      FROM picks p
      JOIN fights f ON p.fight_id = f.id
      WHERE p.user_id = ${userId} AND f.event_id = ${eventId}
    `;
    return new Map(rows.rows.map((row) => [row.fight_id, row]));
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch picks for event.');
  }
}

type ScoredPickRow = {
  user_id: number;
  display_name: string;
  predicted_winner_id: number;
  predicted_method_category: MethodCategory;
  predicted_round: number | null;
  winner_id: number | null;
  method: string;
  round: number;
};

function aggregateLeaderboard(rows: ScoredPickRow[]): { userId: number; displayName: string; points: number }[] {
  const byUser = new Map<number, { displayName: string; points: number }>();
  for (const row of rows) {
    const points = scorePick(
      { predicted_winner_id: row.predicted_winner_id, predicted_method_category: row.predicted_method_category, predicted_round: row.predicted_round },
      { winner_id: row.winner_id, method: row.method, round: row.round },
    );
    const existing = byUser.get(row.user_id);
    if (existing) {
      existing.points += points;
    } else {
      byUser.set(row.user_id, { displayName: row.display_name, points });
    }
  }
  return [...byUser.entries()]
    .map(([userId, entry]) => ({ userId, ...entry }))
    .sort((a, b) => b.points - a.points);
}

export async function fetchEventLeaderboard(eventId: string) {
  try {
    const rows = await sql<ScoredPickRow>`
      SELECT u.id AS user_id, u.display_name, p.predicted_winner_id, p.predicted_method_category, p.predicted_round,
             f.winner_id, f.method, f.round
      FROM picks p
      JOIN users u ON p.user_id = u.id
      JOIN fights f ON p.fight_id = f.id
      WHERE f.event_id = ${eventId}
    `;
    return aggregateLeaderboard(rows.rows);
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch event leaderboard.');
  }
}

export async function fetchAllTimeLeaderboard() {
  try {
    const rows = await sql<ScoredPickRow>`
      SELECT u.id AS user_id, u.display_name, p.predicted_winner_id, p.predicted_method_category, p.predicted_round,
             f.winner_id, f.method, f.round
      FROM picks p
      JOIN users u ON p.user_id = u.id
      JOIN fights f ON p.fight_id = f.id
    `;
    return aggregateLeaderboard(rows.rows);
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch all-time leaderboard.');
  }
}

export type PickHistoryEntry = {
  eventId: number;
  eventName: string;
  eventDate: string;
  fighter1Name: string;
  fighter2Name: string;
  predictedWinnerName: string;
  points: number | null;
};

export async function fetchUserPickHistory(userId: number): Promise<PickHistoryEntry[]> {
  try {
    const rows = await sql<{
      event_id: number;
      event_name: string;
      event_date: string;
      fighter1_name: string;
      fighter2_name: string;
      predicted_winner_id: number;
      predicted_winner_name: string;
      predicted_method_category: MethodCategory;
      predicted_round: number | null;
      fight_finished: boolean;
      winner_id: number | null;
      method: string;
      round: number;
    }>`
      SELECT
        e.id AS event_id, e.name AS event_name, e.date AS event_date,
        f1.name AS fighter1_name, f2.name AS fighter2_name,
        p.predicted_winner_id, pw.name AS predicted_winner_name,
        p.predicted_method_category, p.predicted_round,
        f.fight_finished, f.winner_id, f.method, f.round
      FROM picks p
      JOIN fights f ON p.fight_id = f.id
      JOIN events e ON f.event_id = e.id
      JOIN fighters f1 ON f.fighter1_id = f1.id
      JOIN fighters f2 ON f.fighter2_id = f2.id
      JOIN fighters pw ON p.predicted_winner_id = pw.id
      WHERE p.user_id = ${userId}
      ORDER BY e.date DESC
    `;

    return rows.rows.map((row) => ({
      eventId: row.event_id,
      eventName: row.event_name,
      eventDate: row.event_date,
      fighter1Name: row.fighter1_name,
      fighter2Name: row.fighter2_name,
      predictedWinnerName: row.predicted_winner_name,
      points: row.fight_finished
        ? scorePick(
            { predicted_winner_id: row.predicted_winner_id, predicted_method_category: row.predicted_method_category, predicted_round: row.predicted_round },
            { winner_id: row.winner_id, method: row.method, round: row.round },
          )
        : null,
    }));
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch pick history.');
  }
}
```

- [x] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [x] **Step 3: Commit**

```bash
git add data/lib/picks-data.ts
git commit -m "feat(picks): add picks-data persistence and leaderboard functions"
```

---

## Task 15: `POST /api/picks`

**Files:**
- Create: `app/api/picks/route.ts`

- [x] **Step 1: Write the implementation**

```ts
// app/api/picks/route.ts
import { sql } from '@/data/lib/db';
import { isEventLocked } from '@/data/lib/pick-lock';
import { getOrCreateCurrentUser, upsertPick } from '@/data/lib/picks-data';
import type { MethodCategory } from '@/data/lib/definitions';

// Same reasoning as app/seed/route.ts: without this, @neondatabase/serverless's
// underlying fetch() calls can get swept into Next's Data Cache.
export const dynamic = 'force-dynamic';

const VALID_METHOD_CATEGORIES: MethodCategory[] = ['ko_tko', 'submission', 'decision'];

export async function POST(request: Request) {
  const userId = await getOrCreateCurrentUser();
  if (!userId) {
    return Response.json({ error: 'Vous devez être connecté pour pronostiquer.' }, { status: 401 });
  }

  const body = await request.json();
  const { fightId, predictedWinnerId, predictedMethodCategory, predictedRound } = body;

  if (!VALID_METHOD_CATEGORIES.includes(predictedMethodCategory)) {
    return Response.json({ error: 'Catégorie de méthode invalide.' }, { status: 400 });
  }

  const fightRows = await sql<{ id: number; event_id: number }>`
    SELECT id, event_id FROM fights WHERE id = ${fightId}
  `;
  const fight = fightRows.rows[0];
  if (!fight) {
    return Response.json({ error: 'Combat introuvable.' }, { status: 404 });
  }

  const eventRows = await sql<{ start_time: string | null; date: string }>`
    SELECT start_time, date FROM events WHERE id = ${fight.event_id}
  `;
  const event = eventRows.rows[0];
  if (!event || isEventLocked(event, new Date())) {
    return Response.json({ error: 'Cet événement a démarré, les pronostics sont clos.' }, { status: 403 });
  }

  await upsertPick({
    userId,
    fightId: fight.id,
    predictedWinnerId,
    predictedMethodCategory,
    predictedRound: predictedMethodCategory === 'decision' ? null : predictedRound,
  });

  return Response.json({ ok: true });
}
```

- [x] **Step 2: Manual verification**

With `npm run dev` running and signed in via a browser (to get a session cookie), from that browser's devtools console:

```js
fetch('/api/picks', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ fightId: /* a real upcoming fight id */ 1, predictedWinnerId: 1, predictedMethodCategory: 'decision', predictedRound: null }),
}).then((r) => r.json()).then(console.log);
```

Expected: `{ ok: true }`. Query `SELECT * FROM picks WHERE fight_id = 1` — one row exists.
Repeat against a fight whose event has already started (or force one via a test row) — expect `{ error: '...clos.' }` with status 403.
Sign out and repeat — expect `{ error: '...connecté...' }` with status 401.

- [x] **Step 3: Commit**

```bash
git add app/api/picks/route.ts
git commit -m "feat(picks): add POST /api/picks"
```

---

## Task 16: Pick form and pick result components

**Files:**
- Create: `components/ui/picks/pick-form.tsx`
- Create: `components/ui/picks/pick-result.tsx`
- Create: `components/ui/picks/fight-pick-section.tsx`

- [x] **Step 1: Write `pick-form.tsx`**

```tsx
// components/ui/picks/pick-form.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { FightWithFighters, MethodCategory } from '@/data/lib/definitions';
import type { StoredPick } from '@/data/lib/picks-data';

const methodLabels: Record<MethodCategory, string> = {
  ko_tko: 'KO / TKO',
  submission: 'Soumission',
  decision: 'Décision',
};

export default function PickForm({
  fight,
  initialPick,
}: {
  fight: FightWithFighters;
  initialPick: StoredPick | null;
}) {
  const router = useRouter();
  const [winnerId, setWinnerId] = useState<number | null>(initialPick?.predicted_winner_id ?? null);
  const [method, setMethod] = useState<MethodCategory | null>(initialPick?.predicted_method_category ?? null);
  const [round, setRound] = useState<number | null>(initialPick?.predicted_round ?? null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');

  if (!fight.fighter1 || !fight.fighter2) return null;

  async function handleSubmit() {
    if (!winnerId || !method) return;
    setStatus('saving');
    try {
      const response = await fetch('/api/picks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fightId: fight.id,
          predictedWinnerId: winnerId,
          predictedMethodCategory: method,
          predictedRound: method === 'decision' ? null : round,
        }),
      });
      if (!response.ok) throw new Error('save failed');
      setStatus('idle');
      router.refresh();
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-base-border bg-base-card p-4">
      <div className="flex justify-center gap-4">
        <button
          type="button"
          onClick={() => setWinnerId(fight.fighter1!.id)}
          className={`rounded-md border px-4 py-2 font-display text-sm uppercase tracking-wide ${winnerId === fight.fighter1!.id ? 'border-accent text-accent' : 'border-base-border text-ink-secondary'}`}
        >
          {fight.fighter1.name}
        </button>
        <button
          type="button"
          onClick={() => setWinnerId(fight.fighter2!.id)}
          className={`rounded-md border px-4 py-2 font-display text-sm uppercase tracking-wide ${winnerId === fight.fighter2!.id ? 'border-accent text-accent' : 'border-base-border text-ink-secondary'}`}
        >
          {fight.fighter2.name}
        </button>
      </div>
      <div className="flex justify-center gap-2">
        {(Object.keys(methodLabels) as MethodCategory[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setMethod(option)}
            className={`rounded-md border px-3 py-1 text-xs uppercase tracking-wide ${method === option ? 'border-accent text-accent' : 'border-base-border text-ink-secondary'}`}
          >
            {methodLabels[option]}
          </button>
        ))}
      </div>
      {method && method !== 'decision' && (
        <div className="flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRound(r)}
              className={`h-8 w-8 rounded-md border text-xs ${round === r ? 'border-accent text-accent' : 'border-base-border text-ink-secondary'}`}
            >
              {r}
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!winnerId || !method || status === 'saving'}
        className="rounded-md bg-accent px-4 py-2 font-display text-sm uppercase tracking-wide text-white disabled:opacity-40"
      >
        {status === 'saving' ? 'Enregistrement...' : 'Valider le pronostic'}
      </button>
      {status === 'error' && <p className="text-center text-xs text-accent">Erreur réseau, réessaie.</p>}
    </div>
  );
}
```

- [x] **Step 2: Write `pick-result.tsx`**

```tsx
// components/ui/picks/pick-result.tsx
import type { FightWithFighters, MethodCategory } from '@/data/lib/definitions';
import type { StoredPick } from '@/data/lib/picks-data';
import { scorePick } from '@/data/lib/scoring';

const methodLabels: Record<MethodCategory, string> = {
  ko_tko: 'KO / TKO',
  submission: 'Soumission',
  decision: 'Décision',
};

export default function PickResult({
  fight,
  pick,
}: {
  fight: FightWithFighters;
  pick: StoredPick | null;
}) {
  if (!fight.fighter1 || !fight.fighter2) return null;

  if (!pick) {
    return (
      <p className="rounded-lg border border-base-border bg-base-card p-4 text-center text-xs text-ink-secondary">
        Aucun pronostic enregistré pour ce combat.
      </p>
    );
  }

  const points = fight.fight_finished
    ? scorePick(
        { predicted_winner_id: pick.predicted_winner_id, predicted_method_category: pick.predicted_method_category, predicted_round: pick.predicted_round },
        { winner_id: fight.winner_id, method: fight.method, round: fight.round },
      )
    : null;

  const predictedWinnerName = pick.predicted_winner_id === fight.fighter1.id ? fight.fighter1.name : fight.fighter2.name;
  const correct = points !== null && points > 0;

  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-base-border bg-base-card p-4 text-center">
      <p className="text-xs text-ink-secondary">
        Ton pronostic : <span className="text-ink-primary">{predictedWinnerName}</span> par {methodLabels[pick.predicted_method_category]}
        {pick.predicted_round ? ` au round ${pick.predicted_round}` : ''}
      </p>
      {points !== null && (
        <p className={`font-display text-sm uppercase tracking-wide ${correct ? 'text-win' : 'text-accent'}`}>
          {correct ? `Correct — +${points} pts` : 'Incorrect — 0 pt'}
        </p>
      )}
    </div>
  );
}
```

- [x] **Step 3: Write `fight-pick-section.tsx`**

```tsx
// components/ui/picks/fight-pick-section.tsx
import Link from 'next/link';
import type { FightWithFighters } from '@/data/lib/definitions';
import type { StoredPick } from '@/data/lib/picks-data';
import PickForm from './pick-form';
import PickResult from './pick-result';

export default function FightPickSection({
  fight,
  locked,
  signedIn,
  pick,
}: {
  fight: FightWithFighters;
  locked: boolean;
  signedIn: boolean;
  pick: StoredPick | null;
}) {
  if (!signedIn) {
    return (
      <p className="rounded-lg border border-base-border bg-base-card p-4 text-center text-xs text-ink-secondary">
        <Link href="/sign-in" className="text-accent hover:underline">
          Connecte-toi
        </Link>{' '}
        pour pronostiquer ce combat.
      </p>
    );
  }

  if (locked) {
    return <PickResult fight={fight} pick={pick} />;
  }

  return <PickForm fight={fight} initialPick={pick} />;
}
```

- [x] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [x] **Step 5: Commit**

```bash
git add components/ui/picks
git commit -m "feat(picks): add pick form, result, and section components"
```

---

## Task 17: Wire pronostics into the event page

**Files:**
- Modify: `app/events/[slug]/page.tsx`

- [x] **Step 1: Update the implementation**

Replace the full contents of `app/events/[slug]/page.tsx` with:

```tsx
import { notFound } from 'next/navigation';
import { fetchEventById, fetchFightsByEvent } from '@/data/lib/data';
import { splitMainEvent } from '@/data/lib/fight-utils';
import { isEventLocked } from '@/data/lib/pick-lock';
import { fetchPicksForEvent, fetchEventLeaderboard, getOrCreateCurrentUser, type StoredPick } from '@/data/lib/picks-data';
import { CoverImage } from '@/components/ui/shared/media';
import FightCard from '@/components/ui/fights/fight-card';
import FightRow from '@/components/ui/fights/fight-row';
import FightPickSection from '@/components/ui/picks/fight-pick-section';
import EmptyState from '@/components/ui/shared/empty-state';

export default async function Page({ params }: { params: { slug: string } }) {
  const event = await fetchEventById(params.slug);

  if (!event) {
    notFound();
  }

  const fights = await fetchFightsByEvent(params.slug);
  const { mainEvent, rest } = splitMainEvent(fights);
  const locked = isEventLocked(event, new Date());

  const userId = await getOrCreateCurrentUser();
  const userPicks: Map<number, StoredPick> = userId ? await fetchPicksForEvent(userId, params.slug) : new Map();

  const leaderboard = locked ? await fetchEventLeaderboard(params.slug) : [];

  return (
    <main className="flex min-h-screen flex-col gap-6 p-6">
      <div className="flex items-center gap-4 border-b border-base-border pb-6">
        <CoverImage src={event.event_poster} alt={event.name} className="h-20 w-20 rounded-md" />
        <div>
          <h1 className="font-display text-2xl uppercase tracking-wide text-ink-primary">{event.name}</h1>
          <p className="text-sm text-ink-secondary">
            {event.date} · {event.event_location}
          </p>
        </div>
      </div>
      {fights.length === 0 ? (
        <EmptyState
          title="Aucun combat annoncé"
          description="La card de cet événement n'a pas encore été communiquée."
        />
      ) : (
        <>
          {mainEvent && (
            <div className="flex flex-col gap-3">
              <FightCard fight={mainEvent} event={event} />
              <FightPickSection
                fight={mainEvent}
                locked={locked}
                signedIn={Boolean(userId)}
                pick={userPicks.get(mainEvent.id) ?? null}
              />
            </div>
          )}
          <div className="flex flex-col gap-3">
            {rest.map((fight) => (
              <div key={fight.id} className="flex flex-col gap-3">
                <FightRow fight={fight} />
                <FightPickSection
                  fight={fight}
                  locked={locked}
                  signedIn={Boolean(userId)}
                  pick={userPicks.get(fight.id) ?? null}
                />
              </div>
            ))}
          </div>
        </>
      )}
      {locked && (
        <div className="flex flex-col gap-3 border-t border-base-border pt-6">
          <h2 className="font-display text-lg uppercase tracking-wide text-ink-primary">Classement de cet événement</h2>
          {leaderboard.length === 0 ? (
            <EmptyState title="Aucun pronostic" description="Personne n'a pronostiqué cet événement." />
          ) : (
            <ol className="flex flex-col gap-2">
              {leaderboard.map((entry, index) => (
                <li
                  key={entry.userId}
                  className="flex items-center justify-between rounded-lg border border-base-border bg-base-card px-4 py-2"
                >
                  <span className="text-sm text-ink-primary">
                    #{index + 1} {entry.displayName}
                  </span>
                  <span className="font-display text-sm text-accent">{entry.points} pts</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </main>
  );
}
```

- [x] **Step 2: Manual verification**

Run: `npm run dev`. Signed out: open an upcoming event, each fight shows "Connecte-toi pour pronostiquer". Sign in: each fight shows the pick form; submit one, confirm the page refreshes with the selection reflected. Open an event whose `start_time` is in the past (or a finished one): each fight shows the read-only `PickResult` instead of the form, and a "Classement de cet événement" section appears below.

- [x] **Step 3: Commit**

```bash
git add "app/events/[slug]/page.tsx"
git commit -m "feat(events): wire pronostics section into the event page"
```

---

## Task 18: All-time leaderboard page

**Files:**
- Create: `app/classement/page.tsx`
- Create: `app/classement/loading.tsx`
- Create: `app/classement/error.tsx`

- [x] **Step 1: Write `page.tsx`**

```tsx
// app/classement/page.tsx
import { fetchAllTimeLeaderboard } from '@/data/lib/picks-data';
import EmptyState from '@/components/ui/shared/empty-state';

export default async function Page() {
  const leaderboard = await fetchAllTimeLeaderboard();

  return (
    <main className="flex min-h-screen flex-col gap-6 p-6">
      <h1 className="font-display text-2xl uppercase tracking-wide text-ink-primary">Classement</h1>
      {leaderboard.length === 0 ? (
        <EmptyState title="Aucun pronostic" description="Personne n'a encore pronostiqué d'événement." />
      ) : (
        <ol className="flex flex-col gap-2">
          {leaderboard.map((entry, index) => (
            <li
              key={entry.userId}
              className="flex items-center justify-between rounded-lg border border-base-border bg-base-card px-4 py-2"
            >
              <span className="text-sm text-ink-primary">
                #{index + 1} {entry.displayName}
              </span>
              <span className="font-display text-sm text-accent">{entry.points} pts</span>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
```

- [x] **Step 2: Write `loading.tsx`**

```tsx
// app/classement/loading.tsx
export default function Loading() {
  return (
    <main role="status" aria-label="Chargement" className="flex min-h-screen flex-col gap-3 p-6">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} aria-hidden="true" className="h-12 animate-pulse rounded-lg border border-base-border bg-base-card" />
      ))}
    </main>
  );
}
```

- [x] **Step 3: Write `error.tsx`**

```tsx
// app/classement/error.tsx
'use client';

import ErrorState from '@/components/ui/shared/error-state';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <ErrorState title="Impossible de charger le classement" />
      <button
        onClick={reset}
        className="mt-4 rounded-md border border-base-border px-4 py-2 text-sm text-ink-secondary hover:border-accent hover:text-accent"
      >
        Réessayer
      </button>
    </main>
  );
}
```

- [x] **Step 4: Manual verification**

Run: `npm run dev`, open `/classement`. With no picks scored yet, expect the empty state. After Task 17's manual verification produced a scored pick, expect that user listed with their points.

- [x] **Step 5: Commit**

```bash
git add app/classement
git commit -m "feat(classement): add all-time leaderboard page"
```

---

## Task 19: "Mes pronostics" page

**Files:**
- Create: `app/mes-pronostics/page.tsx`
- Create: `app/mes-pronostics/loading.tsx`
- Create: `app/mes-pronostics/error.tsx`

- [x] **Step 1: Write `page.tsx`**

```tsx
// app/mes-pronostics/page.tsx
import Link from 'next/link';
import { getOrCreateCurrentUser, fetchUserPickHistory } from '@/data/lib/picks-data';
import EmptyState from '@/components/ui/shared/empty-state';

export default async function Page() {
  const userId = await getOrCreateCurrentUser();

  if (!userId) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm text-ink-secondary">Connecte-toi pour voir tes pronostics.</p>
        <Link href="/sign-in" className="font-display text-sm uppercase tracking-wide text-accent">
          Connexion
        </Link>
      </main>
    );
  }

  const history = await fetchUserPickHistory(userId);
  const totalPoints = history.reduce((sum, entry) => sum + (entry.points ?? 0), 0);

  return (
    <main className="flex min-h-screen flex-col gap-6 p-6">
      <div className="flex items-center justify-between border-b border-base-border pb-6">
        <h1 className="font-display text-2xl uppercase tracking-wide text-ink-primary">Mes pronostics</h1>
        <span className="font-display text-lg text-accent">{totalPoints} pts</span>
      </div>
      {history.length === 0 ? (
        <EmptyState title="Aucun pronostic" description="Va sur un événement à venir pour pronostiquer un combat." />
      ) : (
        <div className="flex flex-col gap-3">
          {history.map((entry, index) => (
            <Link
              key={index}
              href={`/events/${entry.eventId}`}
              className="flex items-center justify-between rounded-lg border border-base-border bg-base-card p-4 transition-colors hover:border-accent"
            >
              <div>
                <p className="font-display text-sm uppercase tracking-wide text-ink-primary">{entry.eventName}</p>
                <p className="text-xs text-ink-secondary">
                  {entry.fighter1Name} vs {entry.fighter2Name} · pronostic : {entry.predictedWinnerName}
                </p>
              </div>
              <span className="font-display text-sm text-accent">
                {entry.points === null ? 'À venir' : `${entry.points} pts`}
              </span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
```

- [x] **Step 2: Write `loading.tsx`**

```tsx
// app/mes-pronostics/loading.tsx
export default function Loading() {
  return (
    <main role="status" aria-label="Chargement" className="flex min-h-screen flex-col gap-3 p-6">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} aria-hidden="true" className="h-16 animate-pulse rounded-lg border border-base-border bg-base-card" />
      ))}
    </main>
  );
}
```

- [x] **Step 3: Write `error.tsx`**

```tsx
// app/mes-pronostics/error.tsx
'use client';

import ErrorState from '@/components/ui/shared/error-state';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <ErrorState title="Impossible de charger tes pronostics" />
      <button
        onClick={reset}
        className="mt-4 rounded-md border border-base-border px-4 py-2 text-sm text-ink-secondary hover:border-accent hover:text-accent"
      >
        Réessayer
      </button>
    </main>
  );
}
```

- [x] **Step 4: Manual verification**

Run: `npm run dev`. Signed out, open `/mes-pronostics` — prompt to sign in. Signed in with at least one pick from Task 17 — the pick is listed, with "À venir" if the fight hasn't happened yet, or a point value if it's finished. Total points at the top matches the sum.

- [x] **Step 5: Commit**

```bash
git add app/mes-pronostics
git commit -m "feat(mes-pronostics): add pick history page"
```

---

## Task 20: End-to-end manual verification

**Files:** none (verification only)

- [ ] **Step 1: Full flow**

1. `npm run dev`, sign up a new account via `/sign-up`.
2. Open an upcoming event with `start_time` in the future (re-run `npx tsx data/scrapers/rescrape-upcoming.ts ufc && npx tsx data/scrapers/sync-upcoming-to-db.ts` first if none exist yet with a populated `start_time`).
3. Submit a pick on every fight of that event's card (winner, method, round where applicable). Confirm each shows as selected after `router.refresh()`.
4. Query the DB directly and temporarily set that event's `start_time` to a past timestamp (`UPDATE events SET start_time = now() - interval '1 hour' WHERE id = <id>`), to simulate the lock without waiting for a real event.
5. Reload the event page — every fight now shows `PickResult` instead of the form, and a "Classement de cet événement" section appears.
6. Attempt a `POST /api/picks` against that same event from the browser console (Task 15's snippet) — expect `403` with the "clos" message.
7. Manually set `fight_finished = true` and a `winner_id`/`method`/`round` on one of that event's fights (simulating a synced result), reload — `PickResult` shows correct/incorrect and points; `/classement` and `/mes-pronostics` reflect the same point total.
8. Sign out and reload the event page — every fight now shows the "Connecte-toi" prompt instead of the form or result.
9. Restore the event's real `start_time` (undo the temporary UPDATE from step 4) once verification is done, so the seed/sync data isn't left inconsistent for future testing.

Expected: every step behaves as described, no console errors, no 500s.

**Automated check (2026-08-25):** signed-out render of `/events/818` confirmed via browser — every fight correctly shows "Connecte-toi pour pronostiquer ce combat.", no server errors, no unexpected console errors (a pre-existing `SyntaxError: Invalid or unexpected token` also reproduces on unrelated pages like `/fighters` on `main` — not a regression from this plan). Steps 1.1, 1.3, 1.4, 1.6, 1.7, and 1.9 require signing up/in a real Clerk account and mutating live DB rows — both need a human, since Claude does not create accounts or enter credentials. **Remaining for a human:** sign up on `/sign-in`, submit picks on an upcoming event, then follow steps 4–9 above to verify the lock/scoring flow end-to-end.

- [x] **Step 2: Run the full test suite**

Run: `npm test`
Expected: PASS — all of `data/scrapers/shared/fight-sync.test.ts`, `data/scrapers/shared/normalize-date.test.ts`, `data/scrapers/parse.test.ts`, `data/lib/method-category.test.ts`, `data/lib/scoring.test.ts`, `data/lib/pick-lock.test.ts`, plus every pre-existing test file, all passing.

- [x] **Step 3: Type-check the whole project**

Run: `npx tsc --noEmit`
Expected: no errors
