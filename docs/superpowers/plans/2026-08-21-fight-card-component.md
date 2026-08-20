# FightCard Component Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `FightCard` component — a poster-style presentation of a single fight with upcoming/live/finished states — to both the web app and the mobile app, used only for each event's main event.

**Architecture:** Two new nullable/defaulted DB columns (`fighters.nationality`, `fights.is_main_event`) feed a shared `FightWithFighters` shape on both platforms. A pure `splitMainEvent` helper (duplicated per-platform, matching this repo's existing web/mobile duplication convention) pulls the flagged fight out of any fight list; the home page and event detail page (web and mobile) render that fight as `FightCard` and the rest as the existing `FightRow`.

**Tech Stack:** Next.js App Router + Tailwind (web), Expo + NativeWind (mobile), `@neondatabase/serverless` (Postgres), Node's built-in test runner (`node:test`, web only — mobile has no test infra, matching existing components).

**Spec:** `docs/superpowers/specs/2026-08-21-fight-card-component-design.md`

---

## Task 1: Add `nationality` and `is_main_event` DB columns

**Files:**
- Modify: `app/seed/route.ts:132-158` (`seedFighters`), `app/seed/route.ts:92-130` (`seedFights`)

- [ ] **Step 1: Add the `nationality` column to `seedFighters`**

In `app/seed/route.ts`, inside `seedFighters()`, right after the `CREATE TABLE IF NOT EXISTS fighters (...)` block, add:

```ts
  await sql`ALTER TABLE fighters ADD COLUMN IF NOT EXISTS nationality VARCHAR(2);`;
```

So the function starts:

```ts
async function seedFighters() {
  await sql`
    CREATE TABLE IF NOT EXISTS fighters (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      image_url VARCHAR(255),
      weight_class VARCHAR(50),
      organization_id INT REFERENCES organizations(id),
      record VARCHAR(50),
      ranking INT
    );
  `;

  await sql`ALTER TABLE fighters ADD COLUMN IF NOT EXISTS nationality VARCHAR(2);`;

  const insertedFighters = [];
  // ...unchanged...
```

- [ ] **Step 2: Add the `is_main_event` column to `seedFights`**

In the same file, inside `seedFights()`, right after its `CREATE TABLE IF NOT EXISTS fights (...)` block, add:

```ts
  await sql`ALTER TABLE fights ADD COLUMN IF NOT EXISTS is_main_event BOOLEAN NOT NULL DEFAULT false;`;
```

So the function starts:

```ts
async function seedFights() {
  await sql`
    CREATE TABLE IF NOT EXISTS fights (
      id SERIAL PRIMARY KEY,
      event_id INT REFERENCES events(id),
      fighter1_id INT REFERENCES fighters(id),
      fighter2_id INT REFERENCES fighters(id),
      fight_finished BOOLEAN NOT NULL,
      winner_id INT REFERENCES fighters(id),
      method VARCHAR(50),
      round INT,
      time VARCHAR(10),
      weight_class VARCHAR(50)
    );
  `;

  await sql`ALTER TABLE fights ADD COLUMN IF NOT EXISTS is_main_event BOOLEAN NOT NULL DEFAULT false;`;

  const insertedFights = [];
  // ...unchanged...
```

- [ ] **Step 3: Verify the file still compiles**

Run: `npx tsc --noEmit`
Expected: no output (clean pass), matching the current baseline.

- [ ] **Step 4: Commit**

```bash
git add app/seed/route.ts
git commit -m "feat(db): add fighters.nationality and fights.is_main_event columns"
```

*Note: these columns are only created/altered when `/seed` is hit against a real database — there's no local DB in this environment to verify against directly. `nationality` and `is_main_event` are backfilled by hand for fighters/events actually in rotation; that's a manual SQL operation against the live DB, not part of this plan.*

---

## Task 2: Add `nationality` and `is_main_event` to web types

**Files:**
- Modify: `data/lib/definitions.ts`

- [ ] **Step 1: Add the fields**

In `data/lib/definitions.ts`, update `Fighter` and `Fight`:

```ts
export type Fighter = {
    id: number;
    name: string;
    image_url: string;
    weight_class: string;
    organization_id: number;
    record: string;
    ranking: number;
    nationality: string | null;
  };

export type Event = {
    id: number;
    name: string;
    date: string;
    event_location: string;
    event_poster: string;
    organization_id: number;
  };

export type Fight = {
    id: number;
    event_id: number;
    fighter1_id: number;
    fighter2_id: number;
    fight_finished: boolean;
    winner_id: number | null;
    method: string;
    round: number;
    time: string;
    weight_class: string;
    is_main_event: boolean;
  };
```

(Only `Fighter` and `Fight` change — `nationality` goes on `Fighter`, `is_main_event` goes on `Fight`. `FightWithFighters` already extends `Fight`, so it picks up `is_main_event` automatically.)

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no output (clean pass). `data/lib/data.ts` builds its `Fighter`/`Fight`-shaped rows through an `as FightWithFighters[]` type assertion, which TypeScript doesn't flag for missing properties the way a direct assignment would — so this step alone won't surface the gap at the type-checker level. Task 5 fills in the actual `nationality`/`is_main_event` values at runtime; until then, any row built by `data.ts` simply has `nationality`/`is_main_event` as `undefined` at runtime despite the type saying otherwise.

- [ ] **Step 3: Commit**

```bash
git add data/lib/definitions.ts
git commit -m "feat(types): add nationality and is_main_event to web Fighter/Fight types"
```

---

## Task 3: `countryCodeToFlag` util (web) — TDD

**Files:**
- Create: `data/lib/flag-utils.ts`
- Test: `data/lib/flag-utils.test.ts`

- [ ] **Step 1: Write the failing test**

Create `data/lib/flag-utils.test.ts`:

```ts
// data/lib/flag-utils.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countryCodeToFlag } from './flag-utils';

test('countryCodeToFlag converts an uppercase ISO code to its flag emoji', () => {
  assert.equal(countryCodeToFlag('FR'), '🇫🇷');
});

test('countryCodeToFlag normalizes a lowercase code', () => {
  assert.equal(countryCodeToFlag('br'), '🇧🇷');
});

test('countryCodeToFlag returns null for null input', () => {
  assert.equal(countryCodeToFlag(null), null);
});

test('countryCodeToFlag returns null for a malformed code', () => {
  assert.equal(countryCodeToFlag('FRA'), null);
  assert.equal(countryCodeToFlag('1'), null);
  assert.equal(countryCodeToFlag(''), null);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx --test data/lib/flag-utils.test.ts`
Expected: FAIL — `Cannot find module './flag-utils'` (the module doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `data/lib/flag-utils.ts`:

```ts
// data/lib/flag-utils.ts
const REGIONAL_INDICATOR_OFFSET = 127397;

/**
 * Converts an ISO 3166-1 alpha-2 country code (e.g. 'FR') into its flag
 * emoji (🇫🇷) by mapping each letter to a Unicode regional indicator
 * symbol. Returns null for missing or malformed input so callers can skip
 * rendering a flag entirely.
 */
export function countryCodeToFlag(code: string | null): string | null {
  if (!code) return null;
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return null;

  const codePoints = normalized.split('').map((char) => REGIONAL_INDICATOR_OFFSET + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}
```

(Use `.split('')`, not `[...normalized]` — the web `tsconfig.json` has no explicit `target`, which defaults to a pre-ES2015 target where spreading a *string* fails `tsc --noEmit` with TS2802. `String.fromCodePoint(...codePoints)` is fine as-is since `codePoints` is an array, not a string — TS2802 is specific to string iteration.)

- [ ] **Step 4: Run it to verify it passes**

Run: `npx tsx --test data/lib/flag-utils.test.ts`
Expected: PASS — `4 tests`, `4 pass`, `0 fail`.

- [ ] **Step 5: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no output (clean pass).

- [ ] **Step 6: Commit**

```bash
git add data/lib/flag-utils.ts data/lib/flag-utils.test.ts
git commit -m "feat(fights): add countryCodeToFlag util"
```

---

## Task 4: `splitMainEvent` util (web) — TDD

**Files:**
- Create: `data/lib/fight-utils.ts`
- Test: `data/lib/fight-utils.test.ts`

- [ ] **Step 1: Write the failing test**

Create `data/lib/fight-utils.test.ts`:

```ts
// data/lib/fight-utils.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitMainEvent } from './fight-utils';

type FightStub = { id: number; is_main_event: boolean };

function makeFight(id: number, isMainEvent: boolean): FightStub {
  return { id, is_main_event: isMainEvent };
}

test('splitMainEvent pulls out the flagged fight and keeps the rest in order', () => {
  const fights = [makeFight(1, false), makeFight(2, true), makeFight(3, false)];

  const { mainEvent, rest } = splitMainEvent(fights);

  assert.equal(mainEvent?.id, 2);
  assert.deepEqual(
    rest.map((f) => f.id),
    [1, 3],
  );
});

test('splitMainEvent returns a null mainEvent and the full list when nothing is flagged', () => {
  const fights = [makeFight(1, false), makeFight(2, false)];

  const { mainEvent, rest } = splitMainEvent(fights);

  assert.equal(mainEvent, null);
  assert.deepEqual(
    rest.map((f) => f.id),
    [1, 2],
  );
});

test('splitMainEvent returns empty results for an empty input', () => {
  const { mainEvent, rest } = splitMainEvent([]);

  assert.equal(mainEvent, null);
  assert.deepEqual(rest, []);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx --test data/lib/fight-utils.test.ts`
Expected: FAIL — `Cannot find module './fight-utils'`.

- [ ] **Step 3: Write the implementation**

Create `data/lib/fight-utils.ts`:

```ts
// data/lib/fight-utils.ts
/**
 * Splits a fight list into the fight flagged is_main_event (if any) and
 * the rest, so a page can promote that one fight to FightCard while the
 * remainder stays FightRow. When nothing is flagged, mainEvent is null and
 * rest is the full, untouched list — callers fall back to today's
 * behavior (everything rendered as FightRow).
 */
export function splitMainEvent<T extends { is_main_event: boolean }>(
  fights: T[],
): { mainEvent: T | null; rest: T[] } {
  const mainEvent = fights.find((fight) => fight.is_main_event) ?? null;
  const rest = mainEvent ? fights.filter((fight) => !fight.is_main_event) : fights;
  return { mainEvent, rest };
}
```

(`rest` filters by the `is_main_event` flag itself, not object identity — if a data-integrity slip ever flags more than one fight as main event, this excludes all of them from `rest` rather than leaking the extras through. Add a 4th test for this case: `[makeFight(1, true), makeFight(2, false), makeFight(3, true)]` → `mainEvent.id === 1`, `rest` is `[2]`.)

- [ ] **Step 4: Run it to verify it passes**

Run: `npx tsx --test data/lib/fight-utils.test.ts`
Expected: PASS — `4 tests`, `4 pass`, `0 fail`.

- [ ] **Step 5: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no output (clean pass).

- [ ] **Step 6: Commit**

```bash
git add data/lib/fight-utils.ts data/lib/fight-utils.test.ts
git commit -m "feat(fights): add splitMainEvent util"
```

---

## Task 5: Wire `nationality` / `is_main_event` / org abbreviation through the query layer

**Files:**
- Modify: `data/lib/data.ts:74-82` (`fetchEventById`), `data/lib/data.ts:84-160` (`fetchFightsByEvent`)

`FightCard` needs `event.organization_abbreviation` on the event detail page, which `fetchEventById` doesn't currently select (only the web/mobile home pages had it, via `fetchAllEvents`'s join). It also needs `nationality` on each fighter and `is_main_event` on the fight, which `fetchFightsByEvent` doesn't select yet.

- [ ] **Step 1: Add the organization join to `fetchEventById`**

Replace:

```ts
export async function fetchEventById(id: string) {
  try {
    const data = await sql<Event>`SELECT * FROM events WHERE id = ${id}`;
    return data.rows[0] ?? null;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch event.');
  }
}
```

with:

```ts
export async function fetchEventById(id: string) {
  try {
    const data = await sql<Event & { organization_abbreviation: string }>`
      SELECT e.*, o.abbreviation AS organization_abbreviation
      FROM events e
      JOIN organizations o ON e.organization_id = o.id
      WHERE e.id = ${id}
    `;
    return data.rows[0] ?? null;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch event.');
  }
}
```

- [ ] **Step 2: Add `nationality` and `is_main_event` to `fetchFightsByEvent`**

Replace the whole function body with:

```ts
export async function fetchFightsByEvent(eventId: string) {
  try {
    const data = await sql<{
      id: number;
      event_id: number;
      fighter1_id: number;
      fighter2_id: number;
      fight_finished: boolean;
      winner_id: number | null;
      method: string;
      round: number;
      time: string;
      weight_class: string;
      is_main_event: boolean;
      f1_id: number | null;
      f1_name: string | null;
      f1_image_url: string | null;
      f1_weight_class: string | null;
      f1_organization_id: number | null;
      f1_record: string | null;
      f1_ranking: number | null;
      f1_nationality: string | null;
      f2_id: number | null;
      f2_name: string | null;
      f2_image_url: string | null;
      f2_weight_class: string | null;
      f2_organization_id: number | null;
      f2_record: string | null;
      f2_ranking: number | null;
      f2_nationality: string | null;
    }>`
      SELECT
        f.id, f.event_id, f.fighter1_id, f.fighter2_id, f.fight_finished, f.winner_id, f.method, f.round, f.time, f.weight_class, f.is_main_event,
        f1.id AS f1_id, f1.name AS f1_name, f1.image_url AS f1_image_url, f1.weight_class AS f1_weight_class, f1.organization_id AS f1_organization_id, f1.record AS f1_record, f1.ranking AS f1_ranking, f1.nationality AS f1_nationality,
        f2.id AS f2_id, f2.name AS f2_name, f2.image_url AS f2_image_url, f2.weight_class AS f2_weight_class, f2.organization_id AS f2_organization_id, f2.record AS f2_record, f2.ranking AS f2_ranking, f2.nationality AS f2_nationality
      FROM fights f
      LEFT JOIN fighters f1 ON f.fighter1_id = f1.id
      LEFT JOIN fighters f2 ON f.fighter2_id = f2.id
      WHERE f.event_id = ${eventId}
    `;

    return data.rows.map((row) => ({
      id: row.id,
      event_id: row.event_id,
      fighter1_id: row.fighter1_id,
      fighter2_id: row.fighter2_id,
      fight_finished: row.fight_finished,
      winner_id: row.winner_id,
      method: row.method,
      round: row.round,
      time: row.time,
      weight_class: row.weight_class,
      is_main_event: row.is_main_event,
      fighter1: row.f1_id
        ? {
            id: row.f1_id,
            name: row.f1_name,
            image_url: row.f1_image_url,
            weight_class: row.f1_weight_class,
            organization_id: row.f1_organization_id,
            record: row.f1_record,
            ranking: row.f1_ranking,
            nationality: row.f1_nationality,
          }
        : null,
      fighter2: row.f2_id
        ? {
            id: row.f2_id,
            name: row.f2_name,
            image_url: row.f2_image_url,
            weight_class: row.f2_weight_class,
            organization_id: row.f2_organization_id,
            record: row.f2_record,
            ranking: row.f2_ranking,
            nationality: row.f2_nationality,
          }
        : null,
    })) as FightWithFighters[];
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch fights for event.');
  }
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no output (clean pass) — this resolves the errors left open at the end of Task 2.

- [ ] **Step 4: Run the existing test suite**

Run: `npm test`
Expected: `tests 20`, `pass 20`, `fail 0` (unchanged — this task touches no tested code paths).

- [ ] **Step 5: Commit**

```bash
git add data/lib/data.ts
git commit -m "feat(fights): select nationality, is_main_event, and event org abbreviation"
```

---

## Task 6: Web `FightCard` component

**Files:**
- Create: `components/ui/fights/fight-card.tsx`

- [ ] **Step 1: Write the component**

Create `components/ui/fights/fight-card.tsx`:

```tsx
import Link from 'next/link';
import { CoverImage } from '@/components/ui/shared/media';
import { Fighter, FightWithFighters } from '@/data/lib/definitions';
import { countryCodeToFlag } from '@/data/lib/flag-utils';

type FightStatus = 'upcoming' | 'live' | 'finished';

export type FightCardProps = {
  fight: FightWithFighters;
  event: { id: number; date: string; organization_abbreviation: string };
  live?: { round: number };
};

const resultLabel: Record<'win' | 'loss' | 'draw', string> = { win: 'V', loss: 'D', draw: 'N' };
const resultColor: Record<'win' | 'loss' | 'draw', string> = {
  win: 'text-win',
  loss: 'text-accent',
  draw: 'text-ink-secondary',
};

export default function FightCard({ fight, event, live }: FightCardProps) {
  if (!fight.fighter1 || !fight.fighter2) {
    return (
      <div className="rounded-lg border border-base-border bg-base-card p-4 text-sm text-ink-secondary">
        Données des combattants indisponibles pour ce combat.
      </div>
    );
  }

  const status: FightStatus = fight.fight_finished ? 'finished' : live ? 'live' : 'upcoming';

  return (
    <Link
      href={`/events/${event.id}`}
      className="flex flex-col gap-4 rounded-lg border border-base-border bg-base-card p-4 transition-colors hover:border-accent"
    >
      <FightCardHeader status={status} event={event} liveRound={live?.round} />
      <div className="flex items-center justify-between gap-3">
        <FighterColumn fighter={fight.fighter1} status={status} winnerId={fight.winner_id} />
        <FightCardCenter status={status} fight={fight} />
        <FighterColumn fighter={fight.fighter2} status={status} winnerId={fight.winner_id} />
      </div>
      <p className="border-t border-base-border pt-2 text-center font-display text-xs uppercase tracking-wide text-accent">
        Événement principal
      </p>
    </Link>
  );
}

function FightCardHeader({
  status,
  event,
  liveRound,
}: {
  status: FightStatus;
  event: { date: string; organization_abbreviation: string };
  liveRound?: number;
}) {
  if (status === 'live') {
    return (
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 rounded bg-accent px-2 py-0.5 font-display text-[10px] uppercase tracking-wide text-white">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" aria-hidden="true" />
          En direct
        </span>
        <span className="text-xs text-ink-secondary">Round {liveRound}</span>
      </div>
    );
  }

  if (status === 'finished') {
    return (
      <div className="flex items-center justify-between">
        <span className="font-display text-xs uppercase tracking-wide text-accent">{event.organization_abbreviation}</span>
        <span className="rounded border border-base-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-ink-secondary">
          Terminé
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <span className="font-display text-xs uppercase tracking-wide text-accent">{event.organization_abbreviation}</span>
      <span className="text-xs text-ink-secondary">{event.date}</span>
    </div>
  );
}

function FighterColumn({
  fighter,
  status,
  winnerId,
}: {
  fighter: Fighter;
  status: FightStatus;
  winnerId: number | null;
}) {
  const flag = countryCodeToFlag(fighter.nationality);
  const result = winnerId === null ? 'draw' : winnerId === fighter.id ? 'win' : 'loss';

  return (
    <div className="flex flex-1 flex-col items-center gap-1 text-center">
      <CoverImage src={fighter.image_url} alt={fighter.name} className="h-12 w-12 rounded-md" />
      {flag && (
        <span className="text-sm" aria-hidden="true">
          {flag}
        </span>
      )}
      <span className="font-display text-sm uppercase tracking-wide text-ink-primary">{fighter.name}</span>
      {status === 'finished' ? (
        <span className={`font-display text-lg font-bold ${resultColor[result]}`}>{resultLabel[result]}</span>
      ) : (
        fighter.ranking > 0 && (
          <span className="text-[10px] font-bold uppercase tracking-wide text-accent">#{fighter.ranking}</span>
        )
      )}
    </div>
  );
}

function FightCardCenter({ status, fight }: { status: FightStatus; fight: FightWithFighters }) {
  if (status === 'live') {
    return <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-accent" aria-hidden="true" />;
  }

  if (status === 'finished') {
    const parts = [fight.method, fight.round ? `Round ${fight.round}` : null].filter(Boolean);
    return (
      <span className="shrink-0 text-center text-xs text-ink-secondary">
        {parts.length > 0 ? parts.join(' · ') : 'Résultat non précisé'}
      </span>
    );
  }

  return <span className="shrink-0 text-xs font-bold text-ink-secondary">VS</span>;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no output (clean pass).

- [ ] **Step 3: Commit**

```bash
git add components/ui/fights/fight-card.tsx
git commit -m "feat(fights): add web FightCard component"
```

---

## Task 7: Wire `FightCard` into the web home page

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Update the page**

Replace the whole file with:

```tsx
import Link from 'next/link';
import { fetchAllEvents, fetchFightsByEvent, fetchRecentFinishedFights } from '@/data/lib/data';
import { computeNextEvent } from '@/data/lib/event-utils';
import { splitMainEvent } from '@/data/lib/fight-utils';
import NextEventHero from '@/components/ui/events/next-event-hero';
import FightCard from '@/components/ui/fights/fight-card';
import FightRow from '@/components/ui/fights/fight-row';
import FightResultRow from '@/components/ui/fights/fight-result-row';
import EmptyState from '@/components/ui/shared/empty-state';

// Queries the DB on every request instead of at build time — Vercel's build
// step doesn't reliably have DATABASE_URL / DB access yet (see data/lib/db.ts).
export const dynamic = 'force-dynamic';

const RECENT_RESULTS_COUNT = 4;

export default async function Page() {
  const events = await fetchAllEvents();
  const next = computeNextEvent(events);

  // Only fetch the hero event's fight card when the hero is actually an
  // upcoming event — when there's no future event in DB, computeNextEvent
  // falls back to the last past event, which has nothing left "à venir".
  const heroEvent = next && next.isUpcoming ? next.event : null;

  const [heroFights, recentResults] = await Promise.all([
    heroEvent ? fetchFightsByEvent(String(heroEvent.id)) : Promise.resolve([]),
    fetchRecentFinishedFights(RECENT_RESULTS_COUNT),
  ]);

  const { mainEvent, rest } = splitMainEvent(heroFights);

  return (
    <main className="flex min-h-screen flex-col gap-8 p-6">
      {next ? (
        <NextEventHero event={next.event} isUpcoming={next.isUpcoming} />
      ) : (
        <EmptyState title="Aucun événement pour le moment" />
      )}

      {heroFights.length > 0 && heroEvent && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg uppercase tracking-wide text-ink-primary">Combats à venir</h2>
            <Link href={`/events/${heroEvent.id}`} className="text-xs uppercase tracking-wide text-accent hover:underline">
              Voir l&apos;événement
            </Link>
          </div>
          {mainEvent && (
            <div className="mb-3">
              <FightCard fight={mainEvent} event={heroEvent} />
            </div>
          )}
          <div className="flex flex-col gap-3">
            {rest.map((fight) => (
              <FightRow key={fight.id} fight={fight} />
            ))}
          </div>
        </section>
      )}

      {recentResults.length > 0 && (
        <section>
          <h2 className="mb-4 font-display text-lg uppercase tracking-wide text-ink-primary">Derniers résultats</h2>
          <div className="flex flex-col gap-3">
            {recentResults.map((result) => (
              <FightResultRow key={result.id} result={result} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
```

(The only substantive change: `heroEventId` becomes `heroEvent` — the full event object, so it can be passed straight to `FightCard`'s `event` prop — and `heroFights` is split via `splitMainEvent` before rendering.)

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no output (clean pass).

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat(home): show main event as FightCard above Combats à venir"
```

---

## Task 8: Wire `FightCard` into the web event detail page

**Files:**
- Modify: `app/events/[slug]/page.tsx`

- [ ] **Step 1: Update the page**

Replace the whole file with:

```tsx
import { notFound } from 'next/navigation';
import { fetchEventById, fetchFightsByEvent } from '@/data/lib/data';
import { splitMainEvent } from '@/data/lib/fight-utils';
import { CoverImage } from '@/components/ui/shared/media';
import FightCard from '@/components/ui/fights/fight-card';
import FightRow from '@/components/ui/fights/fight-row';
import EmptyState from '@/components/ui/shared/empty-state';

export default async function Page({ params }: { params: { slug: string } }) {
  const event = await fetchEventById(params.slug);

  if (!event) {
    notFound();
  }

  const fights = await fetchFightsByEvent(params.slug);
  const { mainEvent, rest } = splitMainEvent(fights);

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
            <div>
              <FightCard fight={mainEvent} event={event} />
            </div>
          )}
          <div className="flex flex-col gap-3">
            {rest.map((fight) => (
              <FightRow key={fight.id} fight={fight} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
```

`event` now has `organization_abbreviation` thanks to Task 5's join, so it satisfies `FightCard`'s `event` prop directly.

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no output (clean pass).

- [ ] **Step 3: Commit**

```bash
git add app/events/[slug]/page.tsx
git commit -m "feat(events): show main event as FightCard on the event detail page"
```

---

## Task 9: Add `nationality` / `is_main_event` / `fights` / org abbreviation to mobile types

**Files:**
- Modify: `mobile/lib/types.ts`

- [ ] **Step 1: Update the types**

In `mobile/lib/types.ts`:

```ts
export type Fighter = {
  id: number;
  name: string;
  image_url: string;
  weight_class: string;
  organization_id: number;
  record: string;
  ranking: number;
  nationality: string | null;
};
```

```ts
export type FightWithFighters = {
  id: number;
  event_id: number;
  fighter1_id: number;
  fighter2_id: number;
  fight_finished: boolean;
  winner_id: number | null;
  method: string;
  round: number;
  time: string;
  weight_class: string;
  is_main_event: boolean;
  fighter1: Fighter | null;
  fighter2: Fighter | null;
};
```

```ts
export type HomeResponse = {
  nextEvent: NextEventPayload;
  organizations: Organization[];
  fights: FightWithFighters[];
};
```

```ts
export type EventDetailResponse = {
  event: EventWithOrganization;
  fights: FightWithFighters[];
};
```

(`EventDetailResponse.event` changes from `Event` to `EventWithOrganization` — Task 10's API-route change is what actually starts returning `organization_abbreviation` on it, matching Task 5's web-side `fetchEventById` join.)

- [ ] **Step 2: Verify it compiles**

Run (from `mobile/`): `npx tsc --noEmit`
Expected: no output (clean pass) — adding fields to these types doesn't break existing screens, since they only read a subset of each type's fields (structural typing allows the extra ones to go unused).

- [ ] **Step 3: Commit**

```bash
git add mobile/lib/types.ts
git commit -m "feat(types): add nationality, is_main_event, fights, and org abbreviation to mobile types"
```

---

## Task 10: Return `fights` from the mobile home API route

**Files:**
- Modify: `app/api/mobile/home/route.ts`

- [ ] **Step 1: Update the route**

Replace the file with:

```ts
import { NextResponse } from 'next/server';
import { fetchAllEvents, fetchOrganizations, fetchFightsByEvent } from '@/data/lib/data';
import { computeNextEvent } from '@/data/lib/event-utils';

// Required: @neondatabase/serverless issues queries as fetch() calls, which Next.js
// would otherwise cache as static route data.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [events, organizations] = await Promise.all([fetchAllEvents(), fetchOrganizations()]);
    const nextEvent = computeNextEvent(events);
    const fights = nextEvent && nextEvent.isUpcoming ? await fetchFightsByEvent(String(nextEvent.event.id)) : [];
    return NextResponse.json({ nextEvent, organizations, fights });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Failed to fetch home data' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no output (clean pass).

- [ ] **Step 3: Commit**

```bash
git add app/api/mobile/home/route.ts
git commit -m "feat(mobile-api): include next event's fights in /api/mobile/home"
```

---

## Task 11: `countryCodeToFlag` util (mobile)

**Files:**
- Create: `mobile/lib/flag-utils.ts`

No test file — this repo has no mobile test infrastructure (only `data/**/*.test.ts` via `npm test`, web-side). This is a straight duplication of Task 3's already-tested web logic.

- [ ] **Step 1: Write the implementation**

Create `mobile/lib/flag-utils.ts`:

```ts
// mobile/lib/flag-utils.ts
//
// Duplicated from data/lib/flag-utils.ts (already covered by
// data/lib/flag-utils.test.ts) — this repo keeps web and mobile data
// logic in separate, duplicated files (see mobile/lib/types.ts vs.
// data/lib/definitions.ts) rather than sharing a module between the two
// apps, and there's no mobile test runner to cover a mobile-side copy.
const REGIONAL_INDICATOR_OFFSET = 127397;

export function countryCodeToFlag(code: string | null): string | null {
  if (!code) return null;
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return null;

  const codePoints = normalized.split('').map((char) => REGIONAL_INDICATOR_OFFSET + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}
```

(`.split('')`, not `[...normalized]` — matches the web copy exactly, see Task 3's note. Mobile's `tsconfig.json` targets `ESNext`, so the spread form would actually compile fine here, but keeping both copies textually identical avoids any confusion about which one is "the real one".)

- [ ] **Step 2: Verify it compiles**

Run (from `mobile/`): `npx tsc --noEmit`
Expected: no output (clean pass).

- [ ] **Step 3: Commit**

```bash
git add mobile/lib/flag-utils.ts
git commit -m "feat(fights): add mobile countryCodeToFlag util"
```

---

## Task 12: `splitMainEvent` util (mobile)

**Files:**
- Create: `mobile/lib/fight-utils.ts`

- [ ] **Step 1: Write the implementation**

Create `mobile/lib/fight-utils.ts`:

```ts
// mobile/lib/fight-utils.ts
//
// Duplicated from data/lib/fight-utils.ts (already covered by
// data/lib/fight-utils.test.ts) — see the note in mobile/lib/flag-utils.ts.
export function splitMainEvent<T extends { is_main_event: boolean }>(
  fights: T[],
): { mainEvent: T | null; rest: T[] } {
  const mainEvent = fights.find((fight) => fight.is_main_event) ?? null;
  const rest = mainEvent ? fights.filter((fight) => !fight.is_main_event) : fights;
  return { mainEvent, rest };
}
```

- [ ] **Step 2: Verify it compiles**

Run (from `mobile/`): `npx tsc --noEmit`
Expected: no output (clean pass).

- [ ] **Step 3: Commit**

```bash
git add mobile/lib/fight-utils.ts
git commit -m "feat(fights): add mobile splitMainEvent util"
```

---

## Task 13: Mobile `FightCard` component

**Files:**
- Modify: `mobile/components/cards.tsx`

- [ ] **Step 1: Add the import**

At the top of `mobile/components/cards.tsx`, change:

```ts
import type { EventWithOrganization, FighterWithOrganization, FightWithFighters, Organization } from '../lib/types';
```

to:

```ts
import type { EventWithOrganization, Fighter, FighterWithOrganization, FightWithFighters, Organization } from '../lib/types';
import { countryCodeToFlag } from '../lib/flag-utils';
```

- [ ] **Step 2: Add `FightCard` and its helpers**

Append to the end of `mobile/components/cards.tsx`:

```tsx
type FightStatus = 'upcoming' | 'live' | 'finished';

const resultLabel: Record<'win' | 'loss' | 'draw', string> = { win: 'V', loss: 'D', draw: 'N' };
const resultColor: Record<'win' | 'loss' | 'draw', string> = {
  win: 'text-win',
  loss: 'text-accent',
  draw: 'text-ink-secondary',
};

export function FightCard({
  fight,
  event,
  onPress,
  live,
}: {
  fight: FightWithFighters;
  event: { id: number; date: string; organization_abbreviation: string };
  onPress: () => void;
  live?: { round: number };
}) {
  if (!fight.fighter1 || !fight.fighter2) {
    return (
      <View className="rounded-lg border border-base-border bg-base-card p-4">
        <Text className="text-sm text-ink-secondary">Données des combattants indisponibles pour ce combat.</Text>
      </View>
    );
  }

  const status: FightStatus = fight.fight_finished ? 'finished' : live ? 'live' : 'upcoming';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${fight.fighter1.name} contre ${fight.fighter2.name}`}
      className="flex flex-col gap-4 rounded-lg border border-base-border bg-base-card p-4"
    >
      <FightCardHeader status={status} event={event} liveRound={live?.round} />
      <View className="flex-row items-center justify-between gap-3">
        <FightCardFighterColumn fighter={fight.fighter1} status={status} winnerId={fight.winner_id} />
        <FightCardCenter status={status} fight={fight} />
        <FightCardFighterColumn fighter={fight.fighter2} status={status} winnerId={fight.winner_id} />
      </View>
      <Text className="border-t border-base-border pt-2 text-center font-display text-xs uppercase tracking-wide text-accent">
        Événement principal
      </Text>
    </Pressable>
  );
}

function FightCardHeader({
  status,
  event,
  liveRound,
}: {
  status: FightStatus;
  event: { date: string; organization_abbreviation: string };
  liveRound?: number;
}) {
  if (status === 'live') {
    return (
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-1.5 rounded bg-accent px-2 py-0.5">
          <View className="h-1.5 w-1.5 rounded-full bg-white" />
          <Text className="font-display text-[10px] uppercase tracking-wide text-white">En direct</Text>
        </View>
        <Text className="text-xs text-ink-secondary">Round {liveRound}</Text>
      </View>
    );
  }

  if (status === 'finished') {
    return (
      <View className="flex-row items-center justify-between">
        <Text className="font-display text-xs uppercase tracking-wide text-accent">{event.organization_abbreviation}</Text>
        <Text className="rounded border border-base-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-ink-secondary">
          Terminé
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-row items-center justify-between">
      <Text className="font-display text-xs uppercase tracking-wide text-accent">{event.organization_abbreviation}</Text>
      <Text className="text-xs text-ink-secondary">{event.date}</Text>
    </View>
  );
}

function FightCardFighterColumn({
  fighter,
  status,
  winnerId,
}: {
  fighter: Fighter;
  status: FightStatus;
  winnerId: number | null;
}) {
  const flag = countryCodeToFlag(fighter.nationality);
  const result = winnerId === null ? 'draw' : winnerId === fighter.id ? 'win' : 'loss';

  return (
    <View className="flex-1 items-center gap-1">
      <Image source={{ uri: fighter.image_url }} accessible={false} className="h-12 w-12 rounded-full" />
      {flag && <Text className="text-sm">{flag}</Text>}
      <Text className="font-display text-sm uppercase tracking-wide text-ink-primary">{fighter.name}</Text>
      {status === 'finished' ? (
        <Text className={`font-display text-lg font-bold ${resultColor[result]}`}>{resultLabel[result]}</Text>
      ) : (
        fighter.ranking > 0 && (
          <Text className="text-[10px] font-bold uppercase tracking-wide text-accent">#{fighter.ranking}</Text>
        )
      )}
    </View>
  );
}

function FightCardCenter({ status, fight }: { status: FightStatus; fight: FightWithFighters }) {
  if (status === 'live') {
    return <View className="h-2 w-2 rounded-full bg-accent" />;
  }

  if (status === 'finished') {
    const parts = [fight.method, fight.round ? `Round ${fight.round}` : null].filter(Boolean);
    return (
      <Text className="text-center text-xs text-ink-secondary">
        {parts.length > 0 ? parts.join(' · ') : 'Résultat non précisé'}
      </Text>
    );
  }

  return <Text className="text-xs font-bold text-ink-secondary">VS</Text>;
}
```

*Note: unlike the web version, the live-state dot is static rather than pulsing — NativeWind's `animate-pulse` support isn't verified in this project's Expo setup, and a static accent dot conveys the same "live" signal without depending on unverified animation support.*

- [ ] **Step 3: Verify it compiles**

Run (from `mobile/`): `npx tsc --noEmit`
Expected: no output (clean pass).

- [ ] **Step 4: Commit**

```bash
git add mobile/components/cards.tsx
git commit -m "feat(fights): add mobile FightCard component"
```

---

## Task 14: Wire `FightCard` into the mobile home screen

**Files:**
- Modify: `mobile/app/(tabs)/index.tsx`

- [ ] **Step 1: Update the screen**

Replace the file with:

```tsx
import { View, Text, ScrollView, Image, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { getHome } from '../../lib/api';
import { useApi } from '../../lib/use-api';
import { splitMainEvent } from '../../lib/fight-utils';
import { Loading, ErrorState, EmptyState } from '../../components/state';
import { OrganizationCard, FightCard } from '../../components/cards';

export default function HomeScreen() {
  const router = useRouter();
  const [state, reload] = useApi(getHome, []);

  if (state.status === 'loading') return <Loading />;
  if (state.status === 'error') return <ErrorState message={state.message} onRetry={reload} />;

  const { nextEvent, organizations, fights } = state.data;
  const { mainEvent } = splitMainEvent(fights);

  return (
    <ScrollView className="flex-1 bg-base-bg" contentContainerStyle={{ padding: 16, gap: 24 }}>
      {nextEvent ? (
        <Pressable
          onPress={() => router.push(`/events/${nextEvent.event.id}`)}
          className="overflow-hidden rounded-xl border border-base-border bg-base-card"
        >
          {nextEvent.event.event_poster ? (
            <Image source={{ uri: nextEvent.event.event_poster }} className="h-40 w-full" resizeMode="cover" />
          ) : null}
          <View className="p-4">
            <Text className="font-display text-xs uppercase tracking-wide text-accent">
              {nextEvent.isUpcoming ? 'Prochain event' : 'Dernier event'} · {nextEvent.event.organization_abbreviation}
            </Text>
            <Text className="mt-1 font-display text-xl uppercase text-ink-primary">{nextEvent.event.name}</Text>
            <Text className="mt-1 text-sm text-ink-secondary">
              {nextEvent.event.date} · {nextEvent.event.event_location}
            </Text>
          </View>
        </Pressable>
      ) : (
        <EmptyState message="Aucun event à afficher pour le moment." />
      )}

      {mainEvent && nextEvent && (
        <FightCard
          fight={mainEvent}
          event={nextEvent.event}
          onPress={() => router.push(`/events/${nextEvent.event.id}`)}
        />
      )}

      <View className="gap-3">
        <Text className="font-display text-lg uppercase text-ink-primary">Organisations</Text>
        {organizations.map((org) => (
          <OrganizationCard key={org.id} organization={org} onPress={() => router.push(`/orgs/${org.id}`)} />
        ))}
      </View>
    </ScrollView>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run (from `mobile/`): `npx tsc --noEmit`
Expected: no output (clean pass).

- [ ] **Step 3: Commit**

```bash
git add "mobile/app/(tabs)/index.tsx"
git commit -m "feat(mobile-home): show main event as FightCard"
```

---

## Task 15: Wire `FightCard` into the mobile event detail screen

**Files:**
- Modify: `mobile/app/(tabs)/events/[id].tsx`

- [ ] **Step 1: Update the screen**

Replace the file with:

```tsx
import { View, Text, FlatList } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getEvent } from '../../../lib/api';
import { useApi } from '../../../lib/use-api';
import { splitMainEvent } from '../../../lib/fight-utils';
import { Loading, ErrorState, EmptyState } from '../../../components/state';
import { FightRow, FightCard } from '../../../components/cards';

export default function EventDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [state, reload] = useApi(() => getEvent(id), [id]);

  if (state.status === 'loading') return <Loading />;
  if (state.status === 'error') return <ErrorState message={state.message} onRetry={reload} />;

  const { event, fights } = state.data;
  const { mainEvent, rest } = splitMainEvent(fights);

  return (
    <FlatList
      className="flex-1 bg-base-bg"
      contentContainerStyle={{ padding: 16, gap: 12 }}
      data={rest}
      keyExtractor={(fight) => String(fight.id)}
      ListHeaderComponent={
        <View className="mb-4 gap-4">
          <View>
            <Text className="font-display text-2xl uppercase text-ink-primary">{event.name}</Text>
            <Text className="text-sm text-ink-secondary">
              {event.date} · {event.event_location}
            </Text>
          </View>
          {mainEvent && (
            <FightCard fight={mainEvent} event={event} onPress={() => router.push(`/events/${event.id}`)} />
          )}
        </View>
      }
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      ListEmptyComponent={fights.length === 0 ? <EmptyState message="Aucun combat annoncé pour cet event." /> : null}
      renderItem={({ item }) => <FightRow fight={item} />}
    />
  );
}
```

Note `ListEmptyComponent` checks `fights.length === 0` (the original, full list), not `rest.length === 0` — an event with exactly one fight (which becomes the main event) would otherwise incorrectly show the "no fights announced" empty state below a `FightCard` that's clearly showing a fight.

- [ ] **Step 2: Verify it compiles**

Run (from `mobile/`): `npx tsc --noEmit`
Expected: no output (clean pass).

- [ ] **Step 3: Commit**

```bash
git add "mobile/app/(tabs)/events/[id].tsx"
git commit -m "feat(mobile-events): show main event as FightCard on the event detail screen"
```

---

## Final check

- [ ] Run the full web test suite once more: `npm test` — expect `tests 20`, `pass 20`, `fail 0` (this plan adds `data/lib/flag-utils.test.ts` and `data/lib/fight-utils.test.ts`, so the real final count is `tests 27`, `pass 27`, `fail 0` — 20 pre-existing + 4 flag-utils + 3 fight-utils).
- [ ] Run `npx tsc --noEmit` at the repo root — expect a clean pass.
- [ ] Run `npx tsc --noEmit` inside `mobile/` — expect a clean pass.
