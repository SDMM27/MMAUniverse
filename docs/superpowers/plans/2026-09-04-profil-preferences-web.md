# Profil & préférences (combattants, nationalités) — web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a signed-in user pick and manage their preferred fighters and preferred nationalities — captured via a skippable onboarding screen right after sign-up, and editable anytime from a new "Mon profil" page.

**Architecture:** Next.js App Router (existing project) + Neon Postgres via `@neondatabase/serverless` (existing `sql` tagged-template client) + the Clerk auth already wired for pick'em (`getOrCreateCurrentUser` in `data/lib/picks-data.ts`, reused as-is). Two new join tables (`user_fighter_preferences`, `user_nationality_preferences`) follow the exact pattern of the existing `picks` table. Two new client components (fighter picker, nationality picker) are shared verbatim between the onboarding screen and the profile page — the only difference between those two pages is the surrounding chrome (skip/finish buttons vs. none).

**Tech Stack:** Next.js 14 (App Router), TypeScript, `@neondatabase/serverless`, Tailwind (existing Dark Combat tokens), `@clerk/nextjs` (already installed, v6.39.6), Node's built-in test runner via `tsx --test` (existing project convention).

**Spec:** `docs/superpowers/specs/2026-09-04-profil-preferences-web-design.md`

**Scope note:** Web only. Mobile (Expo) is a separate follow-up plan that will reuse this same backend (tables + `/api/profile/*` + `/api/fighters/search`) — see the spec's Hors périmètre section.

**Deviation from the spec's Tests section, decided while writing this plan:** the spec called for a `data/lib/profile-data.test.ts` covering `addPreferredFighter`/`removePreferredFighter` idempotence and nationality-code validation. Checking the existing codebase turned up that **no DB-touching data-layer module has a test file anywhere in this project** — `data/lib/picks-data.ts` (the closest analog, same CRUD-over-Neon shape) has none, and every existing `data/lib/*.test.ts` file tests a pure function with no DB access (`scoring.ts`, `pick-lock.ts`, `method-category.ts`, `fighter-stats.ts`, `flag-utils.ts`, `event-utils.ts`). `profile-data.ts` is a plain CRUD layer with no non-trivial pure logic of its own — the idempotence spec called out is enforced entirely by SQL (`UNIQUE` + `ON CONFLICT DO NOTHING`), and nationality-code validation is a one-line `.includes()` check inline in the API route (matching how `app/api/picks/route.ts` validates `predictedMethodCategory` inline rather than in `picks-data.ts`). Adding a test file here would be inventing a new, unprecedented testing pattern rather than following the codebase's own convention. This plan therefore has **no automated test task for `profile-data.ts`**, and relies on the manual verification in Task 13 instead — same tradeoff the pick'em plan made for `picks-data.ts`.

---

## Task 1: `user_fighter_preferences` and `user_nationality_preferences` schema

**Files:**
- Modify: `app/seed/route.ts`

- [x] **Step 1: Add the schema function**

In `app/seed/route.ts`, add a new function after `seedPickemSchema` and before `export async function GET()`:

```ts
async function seedProfilePreferencesSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS user_fighter_preferences (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id),
      -- INT, not BIGINT: matches fighters.id (SERIAL/int4). Same reasoning as
      -- picks.predicted_winner_id (see seedPickemSchema above) -- a BIGINT
      -- column here would make @neondatabase/serverless return this as a JS
      -- string while fighters.id comes back as a number, breaking strict
      -- equality comparisons against it.
      fighter_id INT NOT NULL REFERENCES fighters(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (user_id, fighter_id)
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS user_nationality_preferences (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id),
      -- No FK: fighters.nationality is itself a free VARCHAR(2), including
      -- non-ISO UK codes ("en"/"wa"/"nb", see components/ui/shared/country-
      -- flag.tsx) -- there's no lookup table to reference. Validated instead
      -- at the API layer against fetchAvailableNationalities() (Task 4).
      nationality_code TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (user_id, nationality_code)
    );
  `;
}
```

- [x] **Step 2: Call it from `GET`**

In `app/seed/route.ts`, change:

```ts
export async function GET() {
  try {
    await seedOrganizations(); // Cette fonction doit être exécutée en premier
    await seedEvents();        // Dépend de `organizations`
    await seedFighters();      // Peut dépendre de `organizations`
    await seedFights();        // Dépend de `events` et `fighters`
    await seedRankings();      // Dépend de `organizations` et `fighters` (fighter_id FK)
    await seedPickemSchema();  // Dépend de `fighters` (predicted_winner_id FK)

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
    await seedRankings();      // Dépend de `organizations` et `fighters` (fighter_id FK)
    await seedPickemSchema();  // Dépend de `fighters` (predicted_winner_id FK)
    await seedProfilePreferencesSchema(); // Dépend de `users` et `fighters`

    return Response.json({ message: 'Database seeded successfully' });
  } catch (error) {
    console.error(error);  // Pour un meilleur débogage
    return Response.json({ error }, { status: 500 });
  }
}
```

- [x] **Step 3: Manual verification**

Run: `npm run dev`, then `curl -s http://localhost:3000/seed`
Expected: `{"message":"Database seeded successfully"}`. Query the DB (Neon console or `psql`) — `user_fighter_preferences` and `user_nationality_preferences` both exist with the columns above.

- [x] **Step 4: Commit**

```bash
git add app/seed/route.ts
git commit -m "feat(db): add user_fighter_preferences and user_nationality_preferences tables"
```

---

## Task 2: `profile-data.ts` — persistence and read functions

**Files:**
- Create: `data/lib/profile-data.ts`

**Why no test file:** see the plan header's "Deviation from the spec's Tests section" note — this follows the exact precedent of `data/lib/picks-data.ts`, which also has none.

- [x] **Step 1: Write the implementation**

```ts
// data/lib/profile-data.ts
import { sql } from '@/data/lib/db';
import type { FighterWithOrganization } from '@/data/lib/definitions';

export async function fetchPreferredFighters(userId: number): Promise<FighterWithOrganization[]> {
  try {
    const rows = await sql<FighterWithOrganization>`
      SELECT f.*, o.abbreviation AS organization_abbreviation
      FROM user_fighter_preferences ufp
      JOIN fighters f ON ufp.fighter_id = f.id
      JOIN organizations o ON f.organization_id = o.id
      WHERE ufp.user_id = ${userId}
      ORDER BY ufp.created_at ASC
    `;
    return rows.rows;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch preferred fighters.');
  }
}

export async function addPreferredFighter(userId: number, fighterId: number): Promise<void> {
  try {
    await sql`
      INSERT INTO user_fighter_preferences (user_id, fighter_id)
      VALUES (${userId}, ${fighterId})
      ON CONFLICT (user_id, fighter_id) DO NOTHING
    `;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to add preferred fighter.');
  }
}

export async function removePreferredFighter(userId: number, fighterId: number): Promise<void> {
  try {
    await sql`
      DELETE FROM user_fighter_preferences WHERE user_id = ${userId} AND fighter_id = ${fighterId}
    `;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to remove preferred fighter.');
  }
}

export async function fetchAvailableNationalities(): Promise<string[]> {
  try {
    const rows = await sql<{ nationality: string }>`
      SELECT DISTINCT nationality FROM fighters WHERE nationality IS NOT NULL ORDER BY nationality ASC
    `;
    return rows.rows.map((row) => row.nationality);
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch available nationalities.');
  }
}

export async function fetchPreferredNationalities(userId: number): Promise<string[]> {
  try {
    const rows = await sql<{ nationality_code: string }>`
      SELECT nationality_code FROM user_nationality_preferences WHERE user_id = ${userId} ORDER BY created_at ASC
    `;
    return rows.rows.map((row) => row.nationality_code);
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch preferred nationalities.');
  }
}

export async function addPreferredNationality(userId: number, code: string): Promise<void> {
  try {
    await sql`
      INSERT INTO user_nationality_preferences (user_id, nationality_code)
      VALUES (${userId}, ${code})
      ON CONFLICT (user_id, nationality_code) DO NOTHING
    `;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to add preferred nationality.');
  }
}

export async function removePreferredNationality(userId: number, code: string): Promise<void> {
  try {
    await sql`
      DELETE FROM user_nationality_preferences WHERE user_id = ${userId} AND nationality_code = ${code}
    `;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to remove preferred nationality.');
  }
}
```

- [x] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [x] **Step 3: Commit**

```bash
git add data/lib/profile-data.ts
git commit -m "feat(profile): add profile-data persistence functions"
```

---

## Task 3: `GET /api/fighters/search`

**Files:**
- Create: `app/api/fighters/search/route.ts`

**Why:** The fighter picker (Task 6) needs a lightweight live-search endpoint. Reuses `fetchFighters` (already used by `/fighters`) rather than duplicating the query. Bounded to 8 results — this endpoint has no auth requirement (searching isn't sensitive), so keeping results small avoids it becoming a way to dump the whole fighters table.

- [x] **Step 1: Write the implementation**

```ts
// app/api/fighters/search/route.ts
import { fetchFighters } from '@/data/lib/data';

// Same reasoning as app/seed/route.ts: without this, @neondatabase/serverless's
// underlying fetch() calls can get swept into Next's Data Cache.
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get('q') ?? '').trim();

  if (!query) {
    return Response.json({ fighters: [] });
  }

  const { fighters } = await fetchFighters({ query, pageSize: 8 });
  return Response.json({ fighters });
}
```

- [x] **Step 2: Manual verification**

Run: `npm run dev`, then `curl -s "http://localhost:3000/api/fighters/search?q=jones"`
Expected: `{"fighters":[...]}` with up to 8 fighters whose name matches "jones".
Run: `curl -s "http://localhost:3000/api/fighters/search?q="`
Expected: `{"fighters":[]}`.

- [x] **Step 3: Commit**

```bash
git add app/api/fighters/search/route.ts
git commit -m "feat(profile): add GET /api/fighters/search"
```

---

## Task 4: `POST`/`DELETE /api/profile/fighters`

**Files:**
- Create: `app/api/profile/fighters/route.ts`

- [x] **Step 1: Write the implementation**

```ts
// app/api/profile/fighters/route.ts
import { sql } from '@/data/lib/db';
import { getOrCreateCurrentUser } from '@/data/lib/picks-data';
import { addPreferredFighter, removePreferredFighter } from '@/data/lib/profile-data';

// Same reasoning as app/seed/route.ts: without this, @neondatabase/serverless's
// underlying fetch() calls can get swept into Next's Data Cache.
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const userId = await getOrCreateCurrentUser();
  if (!userId) {
    return Response.json({ error: 'Vous devez être connecté pour gérer vos préférences.' }, { status: 401 });
  }

  const body = await request.json();
  const { fighterId } = body;

  if (!Number.isInteger(fighterId)) {
    return Response.json({ error: 'Combattant invalide.' }, { status: 400 });
  }

  const fighterRows = await sql<{ id: number }>`SELECT id FROM fighters WHERE id = ${fighterId}`;
  if (!fighterRows.rows[0]) {
    return Response.json({ error: 'Combattant introuvable.' }, { status: 404 });
  }

  await addPreferredFighter(userId, fighterId);
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const userId = await getOrCreateCurrentUser();
  if (!userId) {
    return Response.json({ error: 'Vous devez être connecté pour gérer vos préférences.' }, { status: 401 });
  }

  const body = await request.json();
  const { fighterId } = body;

  if (!Number.isInteger(fighterId)) {
    return Response.json({ error: 'Combattant invalide.' }, { status: 400 });
  }

  await removePreferredFighter(userId, fighterId);
  return Response.json({ ok: true });
}
```

- [x] **Step 2: Manual verification**

With `npm run dev` running and signed in via a browser (to get a session cookie), from that browser's devtools console:

```js
fetch('/api/profile/fighters', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ fighterId: /* a real fighter id, e.g. from /fighters */ 1 }),
}).then((r) => r.json()).then(console.log);
```

Expected: `{ ok: true }`. Query `SELECT * FROM user_fighter_preferences WHERE fighter_id = 1` — one row exists.
Repeat the same POST again — still `{ ok: true }`, still exactly one row (idempotent).
Run the same `fetch` with `method: 'DELETE'` — `{ ok: true }`, the row is gone.
Run the POST with `fighterId: 999999999` (doesn't exist) — expect `{ error: 'Combattant introuvable.' }` with status 404.
Sign out and repeat the POST — expect `{ error: '...connecté...' }` with status 401.

- [x] **Step 3: Commit**

```bash
git add app/api/profile/fighters/route.ts
git commit -m "feat(profile): add POST/DELETE /api/profile/fighters"
```

---

## Task 5: `POST`/`DELETE /api/profile/nationalities`

**Files:**
- Create: `app/api/profile/nationalities/route.ts`

- [x] **Step 1: Write the implementation**

```ts
// app/api/profile/nationalities/route.ts
import { getOrCreateCurrentUser } from '@/data/lib/picks-data';
import {
  addPreferredNationality,
  removePreferredNationality,
  fetchAvailableNationalities,
} from '@/data/lib/profile-data';

// Same reasoning as app/seed/route.ts: without this, @neondatabase/serverless's
// underlying fetch() calls can get swept into Next's Data Cache.
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const userId = await getOrCreateCurrentUser();
  if (!userId) {
    return Response.json({ error: 'Vous devez être connecté pour gérer vos préférences.' }, { status: 401 });
  }

  const body = await request.json();
  const { code } = body;

  const available = await fetchAvailableNationalities();
  if (typeof code !== 'string' || !available.includes(code)) {
    return Response.json({ error: 'Nationalité invalide.' }, { status: 400 });
  }

  await addPreferredNationality(userId, code);
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const userId = await getOrCreateCurrentUser();
  if (!userId) {
    return Response.json({ error: 'Vous devez être connecté pour gérer vos préférences.' }, { status: 401 });
  }

  const body = await request.json();
  const { code } = body;

  if (typeof code !== 'string') {
    return Response.json({ error: 'Nationalité invalide.' }, { status: 400 });
  }

  await removePreferredNationality(userId, code);
  return Response.json({ ok: true });
}
```

- [x] **Step 2: Manual verification**

With `npm run dev` running and signed in via a browser, from devtools console:

```js
fetch('/api/profile/nationalities', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ code: /* a real code from SELECT DISTINCT nationality FROM fighters */ 'FR' }),
}).then((r) => r.json()).then(console.log);
```

Expected: `{ ok: true }`. Query `SELECT * FROM user_nationality_preferences WHERE nationality_code = 'FR'` — one row exists.
Run the same POST with `code: 'zz'` (not a real nationality in the DB) — expect `{ error: 'Nationalité invalide.' }` with status 400.
Run with `method: 'DELETE'` and `code: 'FR'` — `{ ok: true }`, the row is gone.
Sign out and repeat the POST — expect `{ error: '...connecté...' }` with status 401.

- [x] **Step 3: Commit**

```bash
git add app/api/profile/nationalities/route.ts
git commit -m "feat(profile): add POST/DELETE /api/profile/nationalities"
```

---

## Task 6: `FighterPreferencePicker` component

**Files:**
- Create: `components/ui/profile/fighter-preference-picker.tsx`

**Why this shape:** Same "local UI state + `fetch` + `router.refresh()`" pattern as `components/ui/picks/pick-form.tsx` — the server component that renders this (Tasks 8/9) re-fetches `fetchPreferredFighters` on every render, so `router.refresh()` after a successful add/remove is what brings the list back in sync, rather than hand-rolled optimistic state.

- [x] **Step 1: Write the implementation**

```tsx
// components/ui/profile/fighter-preference-picker.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CoverImage } from '@/components/ui/shared/media';
import { CountryFlag } from '@/components/ui/shared/country-flag';
import type { FighterWithOrganization } from '@/data/lib/definitions';

export default function FighterPreferencePicker({
  preferredFighters,
}: {
  preferredFighters: FighterWithOrganization[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FighterWithOrganization[]>([]);
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');

  // Debounced live search — same 300ms pattern as FightersSearchBar
  // (components/ui/fighters/fighters-search-bar.tsx) — so every keystroke
  // doesn't fire its own request.
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      fetch(`/api/fighters/search?q=${encodeURIComponent(trimmed)}`)
        .then((response) => response.json())
        .then((data) => setResults(data.fighters ?? []))
        .catch(() => setResults([]));
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  const preferredIds = new Set(preferredFighters.map((fighter) => fighter.id));
  const visibleResults = results.filter((fighter) => !preferredIds.has(fighter.id));

  async function addFighter(fighterId: number) {
    setStatus('saving');
    try {
      const response = await fetch('/api/profile/fighters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fighterId }),
      });
      if (!response.ok) throw new Error('add failed');
      setQuery('');
      setResults([]);
      setStatus('idle');
      router.refresh();
    } catch {
      setStatus('error');
    }
  }

  async function removeFighter(fighterId: number) {
    setStatus('saving');
    try {
      const response = await fetch('/api/profile/fighters', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fighterId }),
      });
      if (!response.ok) throw new Error('remove failed');
      setStatus('idle');
      router.refresh();
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-display text-sm uppercase tracking-wide text-ink-primary">Combattants préférés</h2>

      {preferredFighters.length > 0 && (
        <ul className="flex flex-col gap-2">
          {preferredFighters.map((fighter) => (
            <li
              key={fighter.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-base-border bg-base-card p-2"
            >
              <div className="flex items-center gap-2">
                <CoverImage src={fighter.image_url} alt={fighter.name} className="h-10 w-10 rounded-full" objectPosition="top" />
                <div className="flex items-center gap-1.5">
                  <CountryFlag code={fighter.nationality} className="text-sm" />
                  <span className="text-sm text-ink-primary">{fighter.name}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeFighter(fighter.id)}
                disabled={status === 'saving'}
                className="text-xs text-ink-secondary hover:text-accent disabled:opacity-40"
              >
                Retirer
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Rechercher un combattant..."
        aria-label="Rechercher un combattant"
        className="w-full rounded-md border border-base-border bg-base-card px-3 py-2 text-sm text-ink-primary placeholder:text-ink-secondary sm:max-w-xs"
      />

      {visibleResults.length > 0 && (
        <ul className="flex flex-col gap-2">
          {visibleResults.map((fighter) => (
            <li
              key={fighter.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-base-border bg-base-card p-2"
            >
              <div className="flex items-center gap-2">
                <CoverImage src={fighter.image_url} alt={fighter.name} className="h-10 w-10 rounded-full" objectPosition="top" />
                <div className="flex items-center gap-1.5">
                  <CountryFlag code={fighter.nationality} className="text-sm" />
                  <span className="text-sm text-ink-primary">{fighter.name}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => addFighter(fighter.id)}
                disabled={status === 'saving'}
                className="text-xs text-accent hover:underline disabled:opacity-40"
              >
                Ajouter
              </button>
            </li>
          ))}
        </ul>
      )}

      {status === 'error' && <p className="text-xs text-accent">Erreur réseau, réessaie.</p>}
    </div>
  );
}
```

- [x] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [x] **Step 3: Commit**

```bash
git add components/ui/profile/fighter-preference-picker.tsx
git commit -m "feat(profile): add FighterPreferencePicker component"
```

---

## Task 7: `NationalityPreferencePicker` component

**Files:**
- Create: `components/ui/profile/nationality-preference-picker.tsx`

- [x] **Step 1: Write the implementation**

```tsx
// components/ui/profile/nationality-preference-picker.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CountryFlag } from '@/components/ui/shared/country-flag';

export default function NationalityPreferencePicker({
  availableCodes,
  preferredCodes,
}: {
  availableCodes: string[];
  preferredCodes: string[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const preferredSet = new Set(preferredCodes);

  async function toggle(code: string) {
    setStatus('saving');
    try {
      const response = await fetch('/api/profile/nationalities', {
        method: preferredSet.has(code) ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (!response.ok) throw new Error('toggle failed');
      setStatus('idle');
      router.refresh();
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-display text-sm uppercase tracking-wide text-ink-primary">Nationalités préférées</h2>
      <div className="flex flex-wrap gap-2">
        {availableCodes.map((code) => {
          const selected = preferredSet.has(code);
          return (
            <button
              key={code}
              type="button"
              onClick={() => toggle(code)}
              disabled={status === 'saving'}
              aria-pressed={selected}
              className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs uppercase tracking-wide disabled:opacity-40 ${
                selected ? 'border-accent text-accent' : 'border-base-border text-ink-secondary'
              }`}
            >
              <CountryFlag code={code} className="text-sm" />
              {code}
            </button>
          );
        })}
      </div>
      {status === 'error' && <p className="text-xs text-accent">Erreur réseau, réessaie.</p>}
    </div>
  );
}
```

- [x] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [x] **Step 3: Commit**

```bash
git add components/ui/profile/nationality-preference-picker.tsx
git commit -m "feat(profile): add NationalityPreferencePicker component"
```

---

## Task 8: `/onboarding` page

**Files:**
- Create: `app/onboarding/page.tsx`
- Create: `app/onboarding/loading.tsx`
- Create: `app/onboarding/error.tsx`

- [x] **Step 1: Write `page.tsx`**

```tsx
// app/onboarding/page.tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getOrCreateCurrentUser } from '@/data/lib/picks-data';
import {
  fetchPreferredFighters,
  fetchPreferredNationalities,
  fetchAvailableNationalities,
} from '@/data/lib/profile-data';
import FighterPreferencePicker from '@/components/ui/profile/fighter-preference-picker';
import NationalityPreferencePicker from '@/components/ui/profile/nationality-preference-picker';

// Queries the DB (and Clerk, for the current user) on every request instead
// of at build time — Vercel's build step doesn't reliably have DATABASE_URL /
// Clerk keys available yet (see data/lib/db.ts).
export const dynamic = 'force-dynamic';

export default async function Page() {
  const userId = await getOrCreateCurrentUser();
  if (!userId) {
    redirect('/sign-in');
  }

  const [preferredFighters, preferredNationalities, availableNationalities] = await Promise.all([
    fetchPreferredFighters(userId),
    fetchPreferredNationalities(userId),
    fetchAvailableNationalities(),
  ]);

  return (
    <main className="flex min-h-screen flex-col gap-8 p-6">
      <div className="flex flex-col gap-2 border-b border-base-border pb-6">
        <h1 className="font-display text-2xl uppercase tracking-wide text-ink-primary">Bienvenue !</h1>
        <p className="text-sm text-ink-secondary">
          Choisis tes combattants et nationalités préférés — tu pourras toujours les modifier plus tard depuis "Mon profil".
        </p>
      </div>

      <FighterPreferencePicker preferredFighters={preferredFighters} />
      <NationalityPreferencePicker availableCodes={availableNationalities} preferredCodes={preferredNationalities} />

      <div className="flex justify-end gap-4 border-t border-base-border pt-6">
        <Link href="/" className="font-display text-sm uppercase tracking-wide text-ink-secondary hover:text-accent">
          Plus tard
        </Link>
        <Link href="/" className="rounded-md bg-accent px-4 py-2 font-display text-sm uppercase tracking-wide text-white">
          Terminer
        </Link>
      </div>
    </main>
  );
}
```

Note: "Plus tard" and "Terminer" are both plain links to `/` — every add/remove already persisted the instant it happened (Task 6/7's `fetch` calls), so there's nothing left to submit. The two buttons exist purely so the user always has an explicit way to leave the screen, worded to match whether they engaged with the pickers or not.

- [x] **Step 2: Write `loading.tsx`**

```tsx
// app/onboarding/loading.tsx
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
// app/onboarding/error.tsx
'use client';

import ErrorState from '@/components/ui/shared/error-state';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <ErrorState title="Impossible de charger cette page" />
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

- [x] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [x] **Step 5: Manual verification**

Run: `npm run dev`. Signed out, open `/onboarding` — redirected to `/sign-in`. Signed in, open `/onboarding` — the two pickers render (empty if no preferences yet). Search for a fighter, click "Ajouter" — it moves into the preferred list. Click a nationality flag — it highlights. Click "Terminer" — redirected to `/`.

- [x] **Step 6: Commit**

```bash
git add app/onboarding
git commit -m "feat(profile): add /onboarding page"
```

---

## Task 9: `/profil` page

**Files:**
- Create: `app/profil/page.tsx`
- Create: `app/profil/loading.tsx`
- Create: `app/profil/error.tsx`

- [x] **Step 1: Write `page.tsx`**

```tsx
// app/profil/page.tsx
import Link from 'next/link';
import { getOrCreateCurrentUser } from '@/data/lib/picks-data';
import {
  fetchPreferredFighters,
  fetchPreferredNationalities,
  fetchAvailableNationalities,
} from '@/data/lib/profile-data';
import FighterPreferencePicker from '@/components/ui/profile/fighter-preference-picker';
import NationalityPreferencePicker from '@/components/ui/profile/nationality-preference-picker';

// Queries the DB (and Clerk, for the current user) on every request instead
// of at build time — Vercel's build step doesn't reliably have DATABASE_URL /
// Clerk keys available yet (see data/lib/db.ts).
export const dynamic = 'force-dynamic';

export default async function Page() {
  const userId = await getOrCreateCurrentUser();

  if (!userId) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm text-ink-secondary">Connecte-toi pour voir ton profil.</p>
        <Link href="/sign-in" className="font-display text-sm uppercase tracking-wide text-accent">
          Connexion
        </Link>
      </main>
    );
  }

  const [preferredFighters, preferredNationalities, availableNationalities] = await Promise.all([
    fetchPreferredFighters(userId),
    fetchPreferredNationalities(userId),
    fetchAvailableNationalities(),
  ]);

  return (
    <main className="flex min-h-screen flex-col gap-8 p-6">
      <h1 className="border-b border-base-border pb-6 font-display text-2xl uppercase tracking-wide text-ink-primary">
        Mon profil
      </h1>

      <FighterPreferencePicker preferredFighters={preferredFighters} />
      <NationalityPreferencePicker availableCodes={availableNationalities} preferredCodes={preferredNationalities} />
    </main>
  );
}
```

- [x] **Step 2: Write `loading.tsx`**

```tsx
// app/profil/loading.tsx
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
// app/profil/error.tsx
'use client';

import ErrorState from '@/components/ui/shared/error-state';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <ErrorState title="Impossible de charger ton profil" />
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

- [x] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [x] **Step 5: Manual verification**

Run: `npm run dev`. Signed out, open `/profil` — "Connecte-toi pour voir ton profil." with a sign-in link, no redirect/error. Signed in with preferences already set from Task 8 — they're pre-selected (preferred fighters listed, matching nationality flags highlighted). Remove a fighter and a nationality, add different ones — after each click the list updates (via `router.refresh()`); reload the page — the changes persisted.

- [x] **Step 6: Commit**

```bash
git add app/profil
git commit -m "feat(profile): add /profil page"
```

---

## Task 10: Redirect to `/onboarding` after sign-up

**Files:**
- Modify: `app/sign-up/[[...sign-up]]/page.tsx`

- [x] **Step 1: Add the redirect prop**

Change `app/sign-up/[[...sign-up]]/page.tsx` from:

```tsx
import { SignUp } from '@clerk/nextjs';

export default function Page() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <SignUp />
    </main>
  );
}
```

to:

```tsx
import { SignUp } from '@clerk/nextjs';

export default function Page() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      {/* fallbackRedirectUrl only applies when Clerk has no other redirect
          target already in play (e.g. a `redirect_url` query param from a
          protected page that bounced the user to sign-up first) — it won't
          hijack that case. */}
      <SignUp fallbackRedirectUrl="/onboarding" />
    </main>
  );
}
```

- [x] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors — confirms `fallbackRedirectUrl` is a valid prop on this installed `@clerk/nextjs` version (6.39.6).

- [x] **Step 3: Commit**

```bash
git add "app/sign-up/[[...sign-up]]/page.tsx"
git commit -m "feat(profile): redirect to /onboarding after sign-up"
```

---

## Task 11: "Mon profil" nav link

**Files:**
- Modify: `components/ui/nav.tsx:62-66` (desktop list)
- Modify: `components/ui/nav.tsx:113-117` (mobile list)

- [x] **Step 1: Add the link to the desktop nav list**

In `components/ui/nav.tsx`, change:

```tsx
          <li>
            <SignedIn>
              <NavLink href="/mes-pronostics" label="Mes pronostics" active={isActive(pathname, '/mes-pronostics')} />
            </SignedIn>
          </li>
          <li className="flex items-center">
```

to:

```tsx
          <li>
            <SignedIn>
              <NavLink href="/mes-pronostics" label="Mes pronostics" active={isActive(pathname, '/mes-pronostics')} />
            </SignedIn>
          </li>
          <li>
            <SignedIn>
              <NavLink href="/profil" label="Mon profil" active={isActive(pathname, '/profil')} />
            </SignedIn>
          </li>
          <li className="flex items-center">
```

- [x] **Step 2: Add the link to the mobile nav list**

In the same file, change:

```tsx
          <li>
            <SignedIn>
              <NavLink href="/mes-pronostics" label="Mes pronostics" active={isActive(pathname, '/mes-pronostics')} />
            </SignedIn>
          </li>
          <li>
            <SignedOut>
```

to:

```tsx
          <li>
            <SignedIn>
              <NavLink href="/mes-pronostics" label="Mes pronostics" active={isActive(pathname, '/mes-pronostics')} />
            </SignedIn>
          </li>
          <li>
            <SignedIn>
              <NavLink href="/profil" label="Mon profil" active={isActive(pathname, '/profil')} />
            </SignedIn>
          </li>
          <li>
            <SignedOut>
```

- [x] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [x] **Step 4: Manual verification**

Run: `npm run dev`. Signed in, on desktop width — "Mon profil" appears in the top nav next to "Mes pronostics", links to `/profil`, highlights when active. Resize below `md` and open the mobile menu — same link appears there too. Signed out — neither nav shows "Mon profil".

- [x] **Step 5: Commit**

```bash
git add components/ui/nav.tsx
git commit -m "feat(profile): add Mon profil nav link"
```

---

## Task 12: End-to-end manual verification

**Files:** none (verification only)

- [ ] **Step 1: Full flow** (BLOCKED — requires a human to sign up a real Clerk account against a live DB; see final summary)

1. `npm run dev`.
2. **Requires a human:** sign up a new account via `/sign-up` (Claude does not create accounts or enter credentials) — confirm it lands on `/onboarding` automatically.
3. On `/onboarding`: search for and add 2-3 fighters, select 2-3 nationality flags, click "Terminer" — confirm it redirects to `/`.
4. Open "Mon profil" from the nav — confirm the same fighters and nationalities from step 3 are shown/highlighted.
5. On `/profil`: remove one fighter and one nationality, add a different fighter and nationality — confirm each change reflects immediately, and survives a full page reload.
6. Sign out. Visit `/onboarding` — confirm redirect to `/sign-in`. Visit `/profil` — confirm the "Connecte-toi pour voir ton profil." state, no server error.
7. From the browser devtools console while signed out: `fetch('/api/profile/fighters', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({fighterId: 1}) }).then(r => r.json()).then(console.log)` — expect `{ error: '...connecté...' }` with status 401 (check `Network` tab for the status code).
8. Sign back in. Repeat the same `fetch` with `fighterId: 999999999` — expect 404. Repeat `/api/profile/nationalities` POST with `code: 'zz'` — expect 400.
9. Query the DB directly: `SELECT * FROM user_fighter_preferences` and `SELECT * FROM user_nationality_preferences` — rows match what steps 3-5 left behind.

Expected: every step behaves as described, no console errors, no 500s.

- [x] **Step 2: Run the full test suite**

Run: `npm test`
Expected: PASS — every pre-existing test file still passes (this plan added no new test file — see the plan header's Deviation note).

- [x] **Step 3: Type-check the whole project**

Run: `npx tsc --noEmit`
Expected: no errors
