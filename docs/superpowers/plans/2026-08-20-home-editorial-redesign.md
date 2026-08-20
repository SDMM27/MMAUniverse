# Home Editorial Redesign (v1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current Home (`/`) — hero + "upcoming events" grid + "all organizations" grid — with an editorial layout: hero (unchanged) + "Combats à venir" (the hero event's full fight card) + "Derniers résultats" (last 4 finished fights across all orgs), and rename the now-misleading "Organisations" nav link to "Home".

**Architecture:** Two new pieces of read-only data plumbing (`fetchRecentFinishedFights` in the existing `data/lib/data.ts` query layer + a `FightResultWithContext` type in `data/lib/definitions.ts`) feed a rewritten `app/page.tsx`. UI reuses the existing `FightRow` component unmodified for "Combats à venir", and a new thin wrapper `FightResultRow` (org/event context label + `FightRow`) for "Derniers résultats", so no existing component's behavior changes for any other page.

**Tech Stack:** Next.js 14 App Router (Server Components), TypeScript, `@neondatabase/serverless` tagged-template SQL (`data/lib/db.ts`), Tailwind (Dark Combat palette).

**Testing note:** This codebase has no automated tests for the DB query layer or for React components (`npm test` only covers pure functions in `data/lib/*.test.ts`, e.g. `event-utils.ts`). Consistent with that existing convention and with the design spec's own Tests section, this plan verifies the new SQL query and UI manually via the dev server rather than introducing a new test pattern for a single feature. No new pure/branching logic is being extracted here that would warrant a unit test.

---

### Task 1: Add the `FightResultWithContext` type

**Files:**
- Modify: `data/lib/definitions.ts`

- [ ] **Step 1: Add the type**

In `data/lib/definitions.ts`, the file currently ends with `FightWithFighters` (lines 48-51) followed by `FightHistoryEntry` and `FighterStats`. Insert a new type immediately after the `FightWithFighters` block:

```ts
export type FightWithFighters = Fight & {
  fighter1: Fighter | null;
  fighter2: Fighter | null;
};

export type FightResultWithContext = FightWithFighters & {
  event_id: number;
  event_name: string;
  event_date: string;
  organization_abbreviation: string;
};
```

(Only the new `FightResultWithContext` block is added — `FightWithFighters` above it is shown for placement context, do not duplicate it.)

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (the new type isn't used anywhere yet, so this just confirms the file still parses).

- [ ] **Step 3: Commit**

```bash
git add data/lib/definitions.ts
git commit -m "feat(home): add FightResultWithContext type

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Add `fetchRecentFinishedFights` query

**Files:**
- Modify: `data/lib/data.ts`

- [ ] **Step 1: Add `FightResultWithContext` to the definitions import**

In `data/lib/data.ts`, the import block is:

```ts
import { sql } from '@/data/lib/db';
import {
    Organization,
    Event,
    Fighter,
    FightHistoryEntry,
    FightWithFighters,
  } from './definitions';
```

Change it to:

```ts
import { sql } from '@/data/lib/db';
import {
    Organization,
    Event,
    Fighter,
    FightHistoryEntry,
    FightWithFighters,
    FightResultWithContext,
  } from './definitions';
```

- [ ] **Step 2: Add the query function**

Append to the end of `data/lib/data.ts` (after `fetchFightsByFighterId`):

```ts
export async function fetchRecentFinishedFights(limit: number) {
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
      event_name: string;
      event_date: string;
      organization_abbreviation: string;
      f1_id: number | null;
      f1_name: string | null;
      f1_image_url: string | null;
      f1_weight_class: string | null;
      f1_organization_id: number | null;
      f1_record: string | null;
      f1_ranking: number | null;
      f2_id: number | null;
      f2_name: string | null;
      f2_image_url: string | null;
      f2_weight_class: string | null;
      f2_organization_id: number | null;
      f2_record: string | null;
      f2_ranking: number | null;
    }>`
      SELECT
        f.id, f.event_id, f.fighter1_id, f.fighter2_id, f.fight_finished, f.winner_id, f.method, f.round, f.time, f.weight_class,
        e.name AS event_name, e.date AS event_date,
        o.abbreviation AS organization_abbreviation,
        f1.id AS f1_id, f1.name AS f1_name, f1.image_url AS f1_image_url, f1.weight_class AS f1_weight_class, f1.organization_id AS f1_organization_id, f1.record AS f1_record, f1.ranking AS f1_ranking,
        f2.id AS f2_id, f2.name AS f2_name, f2.image_url AS f2_image_url, f2.weight_class AS f2_weight_class, f2.organization_id AS f2_organization_id, f2.record AS f2_record, f2.ranking AS f2_ranking
      FROM fights f
      JOIN events e ON f.event_id = e.id
      JOIN organizations o ON e.organization_id = o.id
      LEFT JOIN fighters f1 ON f.fighter1_id = f1.id
      LEFT JOIN fighters f2 ON f.fighter2_id = f2.id
      WHERE f.fight_finished = true
      ORDER BY e.date DESC
      LIMIT ${limit}
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
      event_name: row.event_name,
      event_date: row.event_date,
      organization_abbreviation: row.organization_abbreviation,
      fighter1: row.f1_id
        ? {
            id: row.f1_id,
            name: row.f1_name,
            image_url: row.f1_image_url,
            weight_class: row.f1_weight_class,
            organization_id: row.f1_organization_id,
            record: row.f1_record,
            ranking: row.f1_ranking,
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
          }
        : null,
    })) as FightResultWithContext[];
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch recent finished fights.');
  }
}
```

This mirrors `fetchFightsByEvent` immediately above it in the same file (same fighter-join shape), adding the `events`/`organizations` join for context and filtering to finished fights only.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add data/lib/data.ts
git commit -m "feat(home): add fetchRecentFinishedFights query

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Create the `FightResultRow` component

**Files:**
- Create: `components/ui/fights/fight-result-row.tsx`

- [ ] **Step 1: Write the component**

```tsx
import FightRow from '@/components/ui/fights/fight-row';
import { FightResultWithContext } from '@/data/lib/definitions';

export default function FightResultRow({ result }: { result: FightResultWithContext }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-display text-xs uppercase tracking-wide text-accent">
        {result.organization_abbreviation} · {result.event_name} · {result.event_date}
      </span>
      <FightRow fight={result} />
    </div>
  );
}
```

`FightRow` itself is untouched — `FightResultWithContext` is a structural superset of `FightWithFighters`, so passing `result` straight through type-checks.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/ui/fights/fight-result-row.tsx
git commit -m "feat(home): add FightResultRow component

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Rewrite the Home page

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Replace the file content**

Replace the entire contents of `app/page.tsx` with:

```tsx
import Link from 'next/link';
import { fetchAllEvents, fetchFightsByEvent, fetchRecentFinishedFights } from '@/data/lib/data';
import { computeNextEvent } from '@/data/lib/event-utils';
import NextEventHero from '@/components/ui/events/next-event-hero';
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
  const heroEventId = next && next.isUpcoming ? next.event.id : null;

  const [heroFights, recentResults] = await Promise.all([
    heroEventId ? fetchFightsByEvent(String(heroEventId)) : Promise.resolve([]),
    fetchRecentFinishedFights(RECENT_RESULTS_COUNT),
  ]);

  return (
    <main className="flex min-h-screen flex-col gap-8 p-6">
      {next ? (
        <NextEventHero event={next.event} isUpcoming={next.isUpcoming} />
      ) : (
        <EmptyState title="Aucun événement pour le moment" />
      )}

      {heroFights.length > 0 && heroEventId && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg uppercase tracking-wide text-ink-primary">Combats à venir</h2>
            <Link href={`/events/${heroEventId}`} className="text-xs uppercase tracking-wide text-accent hover:underline">
              Voir l&apos;événement
            </Link>
          </div>
          <div className="flex flex-col gap-3">
            {heroFights.map((fight) => (
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

This drops the `fetchOrganizations` call, the "À venir" `EventCard` grid, and the organizations grid entirely — none of their imports (`fetchOrganizations`, `computeNextEventByOrg`, `splitEventsByStatus`, `OrganizationsList`, `EventCard`) are referenced anymore.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual verification**

Start the dev server:

```bash
npm run dev
```

Open `http://localhost:3000` in a browser and confirm:
- The hero still renders (unchanged from before).
- If the hero event is upcoming and has fights in DB: a "Combats à venir" section appears below it, with fighter-vs-fighter rows and a working "Voir l'événement" link.
- A "Derniers résultats" section appears further down (if any finished fights exist in DB), each row prefixed with an org/event/date label.
- The old "Organisations" grid and "À venir" events grid are gone from `/`.
- No console errors in the browser devtools.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat(home): editorial redesign — combats à venir + derniers résultats

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Rename the nav link

**Files:**
- Modify: `components/ui/nav.tsx:5`

- [ ] **Step 1: Rename the label**

In `components/ui/nav.tsx`, change:

```ts
const links = [
  { href: '/', label: 'Organisations' },
  { href: '/events', label: 'Events' },
  { href: '/fighters', label: 'Fighters' },
];
```

to:

```ts
const links = [
  { href: '/', label: 'Home' },
  { href: '/events', label: 'Events' },
  { href: '/fighters', label: 'Fighters' },
];
```

- [ ] **Step 2: Manual verification**

With the dev server still running (`npm run dev`), reload `http://localhost:3000` and confirm the nav bar now reads "Home" instead of "Organisations", and the link still goes to `/`.

- [ ] **Step 3: Commit**

```bash
git add components/ui/nav.tsx
git commit -m "fix(nav): rename Organisations link to Home

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Final full-flow verification

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Run the existing test suite**

Run: `npm test`
Expected: all existing tests in `data/lib/event-utils.test.ts` still pass (this feature didn't touch `event-utils.ts`, so this just guards against an unrelated regression).

- [ ] **Step 3: Full manual pass**

With `npm run dev` running, in the browser:
- Load `/` — verify hero, "Combats à venir", "Derniers résultats" sections and the "Home" nav label together, per Task 4/5's individual checks.
- Click into an event from "Combats à venir" and a fighter from either section — confirm both still navigate correctly (no changes were made to `/events/[slug]` or `/fighters/[slug]`, this just confirms the reused `FightRow` links weren't broken by the new context wrapper).
- Confirm `/events` and `/fighters` pages are unaffected (this plan didn't touch them).

No commit for this task — it's verification only.
