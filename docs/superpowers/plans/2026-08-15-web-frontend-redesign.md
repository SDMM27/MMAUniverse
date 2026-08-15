# MMA Universe — Web Frontend Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the MMA Universe web frontend (Next.js 14 App Router) in the "Dark Combat" visual system, convert client-fetch pages to Server Components, and add the two new pages (fighters index + fighter profile) approved in the design spec.

**Architecture:** Server Components fetch data directly via `data/lib/data.ts` (kept on `@vercel/postgres` — the DB provider migration is a separate, out-of-scope workstream). A small shared design-token layer (Tailwind colors + a condensed display font) and a handful of presentational atoms (card, empty/error/loading states, safe image) are built first, then consumed by five pages: home, events index, organization, event, fighters index, fighter profile.

**Tech Stack:** Next.js 14.2.4 (App Router), TypeScript, Tailwind CSS 3.4, `@vercel/postgres`.

**Spec:** `docs/superpowers/specs/2026-08-15-web-frontend-redesign-design.md`

**Testing approach (overrides this skill's default TDD steps):** The approved spec explicitly decided against an automated test suite for this workstream (display-only scope, hobby project, no existing test infra). Every task below replaces the usual red/green test steps with a **manual verification step**: run `npm run dev` and check the described behavior at the given URL. Do not skip these steps — they are the only correctness check this plan has.

---

## Prerequisite: local data to verify against

`app/seed/route.ts` currently only runs `seedFights()` — `seedOrganizations()`, `seedEvents()`, and `seedFighters()` are commented out (a chantier-2 gap, not something this plan fixes). With that state, `organizations`/`events`/`fighters` tables are likely empty locally, and every "Verify manually" step below would just show empty states instead of exercising real content.

Before starting Task 7, temporarily uncomment the three calls in `app/seed/route.ts`'s `GET()` handler, hit `/seed` once on your local dev server, then re-comment them (or leave them — re-seeding is idempotent via the `ON CONFLICT` clauses) before committing anything from this plan. Don't commit a change to `app/seed/route.ts` as part of this plan — reactivating it for real is chantier 2's job; this is just a local, throwaway step so the pages have something to render.

## Spec correction found while planning

The approved spec's nav section says *"Organisations / Events / Fighters"* but the sitemap section never listed a global `/events` index — only `/organizations/[slug]` (events of one org). This plan adds `/events` (Task 8) as a straightforward grid page, matching the pattern already used for `/fighters`, and the spec doc has been corrected to match (see diff below, already applied).

---

### Task 1: Design tokens — Tailwind colors, display font, globals.css cleanup

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `components/ui/fonts.ts`
- Modify: `app/globals.css`

- [ ] **Step 1: Add the Dark Combat color palette and display font family to Tailwind**

```ts
// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        base: {
          bg: "#0a0a0a",
          card: "#161616",
          border: "#262626",
        },
        accent: {
          DEFAULT: "#ff3b30",
        },
        ink: {
          primary: "#f5f5f5",
          secondary: "#9a9a9a",
        },
      },
      fontFamily: {
        display: ["var(--font-oswald)", "sans-serif"],
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
};
export default config;
```

- [ ] **Step 2: Add the Oswald display font as a CSS variable next to the existing fonts**

```ts
// components/ui/fonts.ts
import { Inter, Lusitana, Oswald } from 'next/font/google';

export const inter = Inter({ subsets: ['latin'] });

export const lusitana = Lusitana({
    weight: ['400', '700'],
    subsets: ['latin'],
  });

export const oswald = Oswald({
  weight: ['500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-oswald',
});
```

- [ ] **Step 3: Strip the old light/dark gradient boilerplate from globals.css**

```css
/* app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer utilities {
  .text-balance {
    text-wrap: balance;
  }
}
```

- [ ] **Step 4: Verify manually**

Run: `npm run dev`, open `http://localhost:3000`.
Expected: page background is now plain white/default (colors aren't wired into `body` yet — that happens in Task 5), no console error about `--font-oswald` or Tailwind config.

- [ ] **Step 5: Commit**

```bash
git add tailwind.config.ts components/ui/fonts.ts app/globals.css
git commit -m "feat(design): add Dark Combat color tokens and display font"
```

---

### Task 2: Data types — new shapes + fix `Organization.abbreviation` type bug

**Files:**
- Modify: `data/lib/definitions.ts`

- [ ] **Step 1: Fix the abbreviation type bug and add the new shapes needed by the redesign**

```ts
// data/lib/definitions.ts
export type Organization = {
    id: number;
    name: string;
    abbreviation: string;
    logo_link: string;
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
    winner_id: number;
    method: string;
    round: number;
    time: string;
    weight_class: string;
  };

export type Fighter = {
    id: number;
    name: string;
    image_url: string;
    weight_class: string;
    organization_id: number;
    record: string;
    ranking: number;
  };

export type EventWithOrganization = Event & {
  organization_abbreviation: string;
};

export type FighterWithOrganization = Fighter & {
  organization_abbreviation: string;
};

export type FightWithFighters = Fight & {
  fighter1: Fighter | null;
  fighter2: Fighter | null;
};

export type FightHistoryEntry = Fight & {
  event_name: string;
  event_date: string;
  opponent_name: string;
  opponent_image_url: string;
  result: 'win' | 'loss' | 'draw' | 'upcoming';
};

export type FighterStats = {
  wins: number;
  losses: number;
  draws: number;
  ko: number;
  submission: number;
  decision: number;
};
```

- [ ] **Step 2: Verify manually**

Run: `npx tsc --noEmit`
Expected: no new type errors introduced by this file (pre-existing unrelated errors, if any, are out of scope).

- [ ] **Step 3: Commit**

```bash
git add data/lib/definitions.ts
git commit -m "fix(types): correct Organization.abbreviation to string, add redesign shapes"
```

---

### Task 3: Data layer — new queries + pure derivation helpers

**Files:**
- Modify: `data/lib/data.ts`
- Create: `data/lib/event-utils.ts`
- Create: `data/lib/fighter-stats.ts`

- [ ] **Step 1: Add the new query functions to `data/lib/data.ts`, appending after the existing `fetchEventsByOrg`**

```ts
// data/lib/data.ts — append below fetchEventsByOrg

export async function fetchAllEvents() {
  try {
    const data = await sql<Event & { organization_abbreviation: string }>`
      SELECT e.*, o.abbreviation AS organization_abbreviation
      FROM events e
      JOIN organizations o ON e.organization_id = o.id
      ORDER BY e.date ASC
    `;
    return data.rows;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch events.');
  }
}

export async function fetchOrganizationById(id: string) {
  try {
    const data = await sql<Organization>`SELECT * FROM organizations WHERE id = ${id}`;
    return data.rows[0] ?? null;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch organization.');
  }
}

export async function fetchEventById(id: string) {
  try {
    const data = await sql<Event>`SELECT * FROM events WHERE id = ${id}`;
    return data.rows[0] ?? null;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch event.');
  }
}

export async function fetchFightsByEvent(eventId: string) {
  try {
    const data = await sql`
      SELECT
        f.id, f.event_id, f.fighter1_id, f.fighter2_id, f.fight_finished, f.winner_id, f.method, f.round, f.time, f.weight_class,
        f1.id AS f1_id, f1.name AS f1_name, f1.image_url AS f1_image_url, f1.weight_class AS f1_weight_class, f1.organization_id AS f1_organization_id, f1.record AS f1_record, f1.ranking AS f1_ranking,
        f2.id AS f2_id, f2.name AS f2_name, f2.image_url AS f2_image_url, f2.weight_class AS f2_weight_class, f2.organization_id AS f2_organization_id, f2.record AS f2_record, f2.ranking AS f2_ranking
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
    }));
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch fights for event.');
  }
}

export async function fetchAllFighters() {
  try {
    const data = await sql<Fighter & { organization_abbreviation: string }>`
      SELECT f.*, o.abbreviation AS organization_abbreviation
      FROM fighters f
      JOIN organizations o ON f.organization_id = o.id
      ORDER BY f.name ASC
    `;
    return data.rows;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch fighters.');
  }
}

export async function fetchFighterById(id: string) {
  try {
    const data = await sql<Fighter & { organization_abbreviation: string }>`
      SELECT f.*, o.abbreviation AS organization_abbreviation
      FROM fighters f
      JOIN organizations o ON f.organization_id = o.id
      WHERE f.id = ${id}
    `;
    return data.rows[0] ?? null;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch fighter.');
  }
}

export async function fetchFightsByFighterId(fighterId: string) {
  try {
    const data = await sql`
      SELECT
        f.id, f.event_id, f.fighter1_id, f.fighter2_id, f.fight_finished, f.winner_id, f.method, f.round, f.time, f.weight_class,
        e.name AS event_name, e.date AS event_date,
        opponent.name AS opponent_name, opponent.image_url AS opponent_image_url
      FROM fights f
      JOIN events e ON f.event_id = e.id
      JOIN fighters opponent ON opponent.id = (
        CASE WHEN f.fighter1_id = ${fighterId} THEN f.fighter2_id ELSE f.fighter1_id END
      )
      WHERE f.fighter1_id = ${fighterId} OR f.fighter2_id = ${fighterId}
      ORDER BY e.date DESC
    `;

    return data.rows.map((row) => ({
      ...row,
      result: !row.fight_finished
        ? 'upcoming'
        : row.winner_id === null
          ? 'draw'
          : String(row.winner_id) === String(fighterId)
            ? 'win'
            : 'loss',
    })) as Array<Fight & {
      event_name: string;
      event_date: string;
      opponent_name: string;
      opponent_image_url: string;
      result: 'win' | 'loss' | 'draw' | 'upcoming';
    }>;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch fight history.');
  }
}
```

Note: `fetchAllEvents`, `fetchOrganizationById`, `fetchEventById`, `fetchAllFighters`, `fetchFighterById` use the `Event`, `Organization`, `Fighter` types already imported at the top of `data/lib/data.ts` — no new imports needed for those. `fetchFightsByEvent` and `fetchFightsByFighterId` build plain objects and don't need the `FightWithFighters`/`FightHistoryEntry` types imported into this file (the calling pages import those types for their own annotations).

- [ ] **Step 2: Create the pure "next event" derivation helper (no DB access — operates on already-fetched rows)**

```ts
// data/lib/event-utils.ts
import { Event } from './definitions';

export function computeNextEvent(
  events: Array<Event & { organization_abbreviation: string }>,
): { event: Event & { organization_abbreviation: string }; isUpcoming: boolean } | null {
  if (events.length === 0) {
    return null;
  }

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = events.find((event) => event.date >= today);

  if (upcoming) {
    return { event: upcoming, isUpcoming: true };
  }

  return { event: events[events.length - 1], isUpcoming: false };
}
```

This assumes `events` is sorted ascending by `date` (which `fetchAllEvents` already does) and that `date` is stored as an ISO `YYYY-MM-DD` string (true for all current seed data) so plain string comparison sorts correctly.

- [ ] **Step 3: Create the pure fighter stats derivation helper**

```ts
// data/lib/fighter-stats.ts
import { FighterStats } from './definitions';

type ScorableFight = {
  method: string | null;
  result: 'win' | 'loss' | 'draw' | 'upcoming';
};

function categorizeMethod(method: string | null | undefined): 'ko' | 'submission' | 'decision' | 'other' {
  const normalized = (method ?? '').trim().toLowerCase();
  if (normalized.includes('ko')) return 'ko'; // catches both "KO" and "TKO"
  if (normalized.includes('sub')) return 'submission';
  if (normalized.includes('dec')) return 'decision';
  return 'other';
}

export function computeFighterStats(fights: ScorableFight[]): FighterStats {
  const stats: FighterStats = { wins: 0, losses: 0, draws: 0, ko: 0, submission: 0, decision: 0 };

  for (const fight of fights) {
    if (fight.result === 'win') {
      stats.wins += 1;
      const category = categorizeMethod(fight.method);
      if (category === 'ko') stats.ko += 1;
      if (category === 'submission') stats.submission += 1;
      if (category === 'decision') stats.decision += 1;
    } else if (fight.result === 'loss') {
      stats.losses += 1;
    } else if (fight.result === 'draw') {
      stats.draws += 1;
    }
  }

  return stats;
}
```

- [ ] **Step 4: Verify manually**

Run: `npx tsc --noEmit`
Expected: no type errors from the three files touched in this task.

- [ ] **Step 5: Commit**

```bash
git add data/lib/data.ts data/lib/event-utils.ts data/lib/fighter-stats.ts
git commit -m "feat(data): add queries and derivation helpers for redesign pages"
```

---

### Task 4: Shared UI atoms — safe image, empty state, error state, grid skeleton

**Files:**
- Create: `components/ui/shared/media.tsx`
- Create: `components/ui/shared/empty-state.tsx`
- Create: `components/ui/shared/error-state.tsx`
- Create: `components/ui/shared/card-grid-skeleton.tsx`

- [ ] **Step 1: Create the safe image wrapper**

External images come from many different hosts (ESPN CDN, PFL's S3 bucket, and whatever UFC/Bellator scraping adds later) and `next.config.mjs` has no `images.remotePatterns` configured, so `next/image` would reject all of them. This plan keeps using plain `<img>` for remote content (matches the existing codebase pattern) and only guards against empty-string `src`, which otherwise makes the browser re-request the current page as an image.

```tsx
// components/ui/shared/media.tsx
export function CoverImage({
  src,
  alt,
  className = '',
}: {
  src?: string | null;
  alt: string;
  className?: string;
}) {
  if (!src) {
    return <div className={`bg-base-border ${className}`} aria-hidden="true" />;
  }

  return <img src={src} alt={alt} className={`object-cover ${className}`} />;
}
```

- [ ] **Step 2: Create the empty state component**

```tsx
// components/ui/shared/empty-state.tsx
export default function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-base-border bg-base-card py-16 text-center">
      <p className="font-display text-lg uppercase tracking-wide text-ink-primary">{title}</p>
      {description && <p className="max-w-sm text-sm text-ink-secondary">{description}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Create the error state component**

```tsx
// components/ui/shared/error-state.tsx
export default function ErrorState({
  title = 'Une erreur est survenue',
  description,
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-accent/40 bg-base-card py-16 text-center">
      <p className="font-display text-lg uppercase tracking-wide text-accent">{title}</p>
      {description && <p className="max-w-sm text-sm text-ink-secondary">{description}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Create the loading skeleton used by every listing page's `loading.tsx`**

```tsx
// components/ui/shared/card-grid-skeleton.tsx
export default function CardGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="h-40 animate-pulse rounded-lg border border-base-border bg-base-card"
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Verify manually**

Run: `npx tsc --noEmit`
Expected: no type errors. These components aren't wired into any page yet, so there's nothing to see in the browser until Task 5+.

- [ ] **Step 6: Commit**

```bash
git add components/ui/shared
git commit -m "feat(ui): add shared empty/error/loading/media atoms"
```

---

### Task 5: Global nav + layout wiring

**Files:**
- Modify: `components/ui/mma-universe-logo.tsx`
- Create: `components/ui/nav.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Shrink the logo for nav-bar use (it was sized for the old full-width hero banner)**

```tsx
// components/ui/mma-universe-logo.tsx
import { lusitana } from '@/components/ui/fonts';
import Image from 'next/image';

export default function MMAUniverseLogo() {
  return (
    <div className={`${lusitana.className} flex flex-row items-center gap-2 leading-none text-ink-primary`}>
      <Image
        alt="MMA Universe logo"
        width={200}
        height={152}
        className="h-9 w-9 rotate-[15deg]"
        src="/MMAUniverse.png"
      />
      <p className="text-lg">MMA Universe</p>
    </div>
  );
}
```

- [ ] **Step 2: Create the global nav**

```tsx
// components/ui/nav.tsx
import Link from 'next/link';
import MMAUniverseLogo from '@/components/ui/mma-universe-logo';

const links = [
  { href: '/', label: 'Organisations' },
  { href: '/events', label: 'Events' },
  { href: '/fighters', label: 'Fighters' },
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

- [ ] **Step 3: Wire fonts, dark background, and the nav into the root layout**

```tsx
// app/layout.tsx
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

- [ ] **Step 4: Verify manually**

Run: `npm run dev`, open `http://localhost:3000`.
Expected: dark background across the whole page, a nav bar at the top with the (smaller) logo on the left and "Organisations / Events / Fighters" links on the right. Clicking "Events" and "Fighters" 404s for now (their pages don't exist yet) — that's expected until Tasks 8 and 11.

- [ ] **Step 5: Commit**

```bash
git add components/ui/mma-universe-logo.tsx components/ui/nav.tsx app/layout.tsx
git commit -m "feat(ui): add global nav and wire Dark Combat theme into root layout"
```

---

### Task 6: Card components — organization, event, fighter

**Files:**
- Modify: `components/ui/organizations/organizations-list.tsx`
- Create: `components/ui/organizations/organization-card.tsx`
- Create: `components/ui/events/event-card.tsx`
- Create: `components/ui/fighters/fighter-card.tsx`

- [ ] **Step 1: Create the organization card**

```tsx
// components/ui/organizations/organization-card.tsx
import Link from 'next/link';
import { CoverImage } from '@/components/ui/shared/media';
import { Organization } from '@/data/lib/definitions';

export default function OrganizationCard({ organization }: { organization: Organization }) {
  return (
    <Link
      href={`/organizations/${organization.id}`}
      className="flex flex-col items-center gap-3 rounded-lg border border-base-border bg-base-card p-4 transition-colors hover:border-accent"
    >
      <CoverImage
        src={organization.logo_link}
        alt={organization.name}
        className="h-16 w-16 rounded-full"
      />
      <div className="text-center">
        <p className="font-display text-sm uppercase tracking-wide text-ink-primary">{organization.abbreviation}</p>
        <p className="text-xs text-ink-secondary">{organization.name}</p>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Rewrite `organizations-list.tsx` to render a grid of the new card (keeps the same export/import path used by `app/page.tsx`)**

```tsx
// components/ui/organizations/organizations-list.tsx
import { Organization } from '@/data/lib/definitions';
import OrganizationCard from './organization-card';

export default function OrganizationsList({
  organizations,
}: {
  organizations: Organization[];
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      {organizations.map((organization) => (
        <OrganizationCard key={organization.id} organization={organization} />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create the event card (reused by the org page and the new events index — `organization_abbreviation` is optional since the org page already shows the org in its header)**

```tsx
// components/ui/events/event-card.tsx
import Link from 'next/link';
import { CoverImage } from '@/components/ui/shared/media';
import { Event } from '@/data/lib/definitions';

export default function EventCard({
  event,
}: {
  event: Event & { organization_abbreviation?: string };
}) {
  return (
    <Link
      href={`/events/${event.id}`}
      className="flex flex-col overflow-hidden rounded-lg border border-base-border bg-base-card transition-colors hover:border-accent"
    >
      <CoverImage src={event.event_poster} alt={event.name} className="aspect-video w-full" />
      <div className="flex flex-col gap-1 p-3">
        {event.organization_abbreviation && (
          <span className="font-display text-xs uppercase tracking-wide text-accent">
            {event.organization_abbreviation}
          </span>
        )}
        <p className="font-display text-sm uppercase tracking-wide text-ink-primary">{event.name}</p>
        <p className="text-xs text-ink-secondary">
          {event.date} · {event.event_location}
        </p>
      </div>
    </Link>
  );
}
```

- [ ] **Step 4: Create the fighter card**

```tsx
// components/ui/fighters/fighter-card.tsx
import Link from 'next/link';
import { CoverImage } from '@/components/ui/shared/media';
import { FighterWithOrganization } from '@/data/lib/definitions';

export default function FighterCard({ fighter }: { fighter: FighterWithOrganization }) {
  return (
    <Link
      href={`/fighters/${fighter.id}`}
      className="flex flex-col overflow-hidden rounded-lg border border-base-border bg-base-card transition-colors hover:border-accent"
    >
      <CoverImage src={fighter.image_url} alt={fighter.name} className="aspect-square w-full" />
      <div className="flex flex-col gap-1 p-3">
        <span className="font-display text-xs uppercase tracking-wide text-accent">
          {fighter.organization_abbreviation}
        </span>
        <p className="font-display text-sm uppercase tracking-wide text-ink-primary">{fighter.name}</p>
        <p className="text-xs text-ink-secondary">
          {fighter.weight_class} · {fighter.record}
        </p>
      </div>
    </Link>
  );
}
```

- [ ] **Step 5: Verify manually**

Run: `npm run dev`, open `http://localhost:3000`.
Expected: the organizations grid now renders as dark cards with rounded logos, red-accented abbreviation text, hover border turns red. (Data may be sparse/placeholder-looking until chantier 2 — that's expected and out of scope here.)

- [ ] **Step 6: Commit**

```bash
git add components/ui/organizations components/ui/events/event-card.tsx components/ui/fighters/fighter-card.tsx
git commit -m "feat(ui): add Dark Combat card components for organizations, events, fighters"
```

---

### Task 7: Home page — hero + organizations grid

**Files:**
- Modify: `app/page.tsx`
- Create: `components/ui/events/next-event-hero.tsx`
- Create: `app/loading.tsx`
- Create: `app/error.tsx`

- [ ] **Step 1: Create the hero component**

```tsx
// components/ui/events/next-event-hero.tsx
import Link from 'next/link';
import { CoverImage } from '@/components/ui/shared/media';
import { Event } from '@/data/lib/definitions';

export default function NextEventHero({
  event,
  isUpcoming,
}: {
  event: Event & { organization_abbreviation: string };
  isUpcoming: boolean;
}) {
  return (
    <Link
      href={`/events/${event.id}`}
      className="relative flex min-h-[280px] flex-col justify-end overflow-hidden rounded-lg border border-base-border"
    >
      <CoverImage src={event.event_poster} alt={event.name} className="absolute inset-0 h-full w-full" />
      <div className="relative z-10 bg-gradient-to-t from-base-bg via-base-bg/80 to-transparent p-6">
        <span className="font-display text-xs uppercase tracking-wide text-accent">
          {isUpcoming ? 'Prochain événement' : 'Dernier événement'} · {event.organization_abbreviation}
        </span>
        <h1 className="mt-2 font-display text-3xl uppercase tracking-wide text-ink-primary">{event.name}</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          {event.date} · {event.event_location}
        </p>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Rewrite the home page**

```tsx
// app/page.tsx
import { fetchAllEvents, fetchOrganizations } from '@/data/lib/data';
import { computeNextEvent } from '@/data/lib/event-utils';
import NextEventHero from '@/components/ui/events/next-event-hero';
import OrganizationsList from '@/components/ui/organizations/organizations-list';
import EmptyState from '@/components/ui/shared/empty-state';

export default async function Page() {
  const [organizations, events] = await Promise.all([
    fetchOrganizations(),
    fetchAllEvents(),
  ]);
  const next = computeNextEvent(events);

  return (
    <main className="flex min-h-screen flex-col gap-8 p-6">
      {next ? (
        <NextEventHero event={next.event} isUpcoming={next.isUpcoming} />
      ) : (
        <EmptyState title="Aucun événement pour le moment" />
      )}
      <section>
        <h2 className="mb-4 font-display text-lg uppercase tracking-wide text-ink-primary">Organisations</h2>
        <OrganizationsList organizations={organizations} />
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Add the route loading skeleton**

```tsx
// app/loading.tsx
import CardGridSkeleton from '@/components/ui/shared/card-grid-skeleton';

export default function Loading() {
  return (
    <main className="flex min-h-screen flex-col gap-8 p-6">
      <div className="h-[280px] animate-pulse rounded-lg border border-base-border bg-base-card" />
      <CardGridSkeleton />
    </main>
  );
}
```

- [ ] **Step 4: Add the route error boundary (Next.js requires `error.tsx` to be a Client Component)**

```tsx
// app/error.tsx
'use client';

import ErrorState from '@/components/ui/shared/error-state';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <ErrorState
        title="Impossible de charger la page d'accueil"
        description="Réessaie dans quelques instants."
      />
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

- [ ] **Step 5: Verify manually**

Run: `npm run dev`, open `http://localhost:3000`.
Expected: a hero banner showing the most recent PFL event (all current data is from 2021, so it should say "Dernier événement" — not "Prochain événement" — confirming the past-event fallback works), organizations grid below it.

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx app/loading.tsx app/error.tsx components/ui/events/next-event-hero.tsx
git commit -m "feat(home): rewrite home page with next-event hero in Dark Combat style"
```

---

### Task 8: Events index page (new)

**Files:**
- Create: `app/events/page.tsx`
- Create: `app/events/loading.tsx`
- Create: `app/events/error.tsx`

- [ ] **Step 1: Create the page**

```tsx
// app/events/page.tsx
import { fetchAllEvents } from '@/data/lib/data';
import EventCard from '@/components/ui/events/event-card';
import EmptyState from '@/components/ui/shared/empty-state';

export default async function Page() {
  const events = await fetchAllEvents();

  return (
    <main className="flex min-h-screen flex-col gap-6 p-6">
      <h1 className="font-display text-2xl uppercase tracking-wide text-ink-primary">Events</h1>
      {events.length === 0 ? (
        <EmptyState title="Aucun événement pour le moment" />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Add loading and error states**

```tsx
// app/events/loading.tsx
import CardGridSkeleton from '@/components/ui/shared/card-grid-skeleton';

export default function Loading() {
  return (
    <main className="flex min-h-screen flex-col gap-6 p-6">
      <CardGridSkeleton />
    </main>
  );
}
```

```tsx
// app/events/error.tsx
'use client';

import ErrorState from '@/components/ui/shared/error-state';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <ErrorState title="Impossible de charger les events" />
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

- [ ] **Step 3: Verify manually**

Run: `npm run dev`, open `http://localhost:3000/events`.
Expected: a grid of all events across all organizations (currently just PFL events), each card showing its org abbreviation badge. The "Events" nav link no longer 404s.

- [ ] **Step 4: Commit**

```bash
git add app/events/page.tsx app/events/loading.tsx app/events/error.tsx
git commit -m "feat(events): add cross-organization events index page"
```

---

### Task 9: Organization page — convert to Server Component

**Files:**
- Modify: `app/organizations/[slug]/page.tsx`
- Create: `app/organizations/[slug]/loading.tsx`
- Create: `app/organizations/[slug]/error.tsx`
- Delete: `components/ui/events/events-by-org.tsx`

- [ ] **Step 1: Rewrite the page as a Server Component**

```tsx
// app/organizations/[slug]/page.tsx
import { notFound } from 'next/navigation';
import { fetchOrganizationById, fetchEventsByOrg } from '@/data/lib/data';
import { CoverImage } from '@/components/ui/shared/media';
import EventCard from '@/components/ui/events/event-card';
import EmptyState from '@/components/ui/shared/empty-state';

export default async function Page({ params }: { params: { slug: string } }) {
  const organization = await fetchOrganizationById(params.slug);

  if (!organization) {
    notFound();
  }

  const events = await fetchEventsByOrg(params.slug);

  return (
    <main className="flex min-h-screen flex-col gap-6 p-6">
      <div className="flex items-center gap-4 border-b border-base-border pb-6">
        <CoverImage src={organization.logo_link} alt={organization.name} className="h-16 w-16 rounded-full" />
        <div>
          <p className="font-display text-xs uppercase tracking-wide text-accent">{organization.abbreviation}</p>
          <h1 className="font-display text-2xl uppercase tracking-wide text-ink-primary">{organization.name}</h1>
        </div>
      </div>
      {events.length === 0 ? (
        <EmptyState
          title="Aucun événement programmé"
          description="Revenez plus tard pour les prochains events de cette organisation."
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Delete the now-unused client component it replaces**

```bash
git rm components/ui/events/events-by-org.tsx
```

- [ ] **Step 3: Add loading and error states**

```tsx
// app/organizations/[slug]/loading.tsx
import CardGridSkeleton from '@/components/ui/shared/card-grid-skeleton';

export default function Loading() {
  return (
    <main className="flex min-h-screen flex-col gap-6 p-6">
      <div className="h-16 animate-pulse rounded-lg border border-base-border bg-base-card" />
      <CardGridSkeleton />
    </main>
  );
}
```

```tsx
// app/organizations/[slug]/error.tsx
'use client';

import ErrorState from '@/components/ui/shared/error-state';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <ErrorState title="Impossible de charger cette organisation" />
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

- [ ] **Step 4: Verify manually**

Run: `npm run dev`, open `http://localhost:3000`, click on an organization card (e.g. PFL).
Expected: no "Loading..." flash (renders server-side already populated), org header with logo/name, grid of that org's events. Visiting `http://localhost:3000/organizations/999999` (a non-existent id) shows Next's default 404 page.

- [ ] **Step 5: Commit**

```bash
git add app/organizations
git commit -m "refactor(organizations): convert org page to Server Component, drop client fetch"
```

---

### Task 10: Event page — convert to Server Component + fight row

**Files:**
- Modify: `app/events/[slug]/page.tsx`
- Create: `components/ui/fights/fight-row.tsx`
- Create: `app/events/[slug]/loading.tsx`
- Create: `app/events/[slug]/error.tsx`
- Delete: `components/ui/fights/fights-by-event.tsx`

- [ ] **Step 1: Create the fight row component**

```tsx
// components/ui/fights/fight-row.tsx
import { CoverImage } from '@/components/ui/shared/media';
import { FightWithFighters } from '@/data/lib/definitions';

function formatFightResult(fight: FightWithFighters): string {
  if (!fight.fight_finished) return 'À venir';
  const parts = [fight.method, fight.round ? `Round ${fight.round}` : null].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : 'Résultat non précisé';
}

export default function FightRow({ fight }: { fight: FightWithFighters }) {
  if (!fight.fighter1 || !fight.fighter2) {
    return (
      <div className="rounded-lg border border-base-border bg-base-card p-4 text-sm text-ink-secondary">
        Données des combattants indisponibles pour ce combat.
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-base-border bg-base-card p-4">
      <FighterSide name={fight.fighter1.name} record={fight.fighter1.record} image={fight.fighter1.image_url} align="left" />
      <div className="flex shrink-0 flex-col items-center gap-1 text-center">
        <span className="font-display text-xs uppercase tracking-wide text-accent">{fight.weight_class}</span>
        <span className="text-xs text-ink-secondary">{formatFightResult(fight)}</span>
      </div>
      <FighterSide name={fight.fighter2.name} record={fight.fighter2.record} image={fight.fighter2.image_url} align="right" />
    </div>
  );
}

function FighterSide({
  name,
  record,
  image,
  align,
}: {
  name: string;
  record: string;
  image: string;
  align: 'left' | 'right';
}) {
  return (
    <div className={`flex flex-1 items-center gap-3 ${align === 'right' ? 'flex-row-reverse text-right' : ''}`}>
      <CoverImage src={image} alt={name} className="h-12 w-12 shrink-0 rounded-md" />
      <div>
        <p className="font-display text-sm uppercase tracking-wide text-ink-primary">{name}</p>
        <p className="text-xs text-ink-secondary">{record}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite the event page as a Server Component**

```tsx
// app/events/[slug]/page.tsx
import { notFound } from 'next/navigation';
import { fetchEventById, fetchFightsByEvent } from '@/data/lib/data';
import { CoverImage } from '@/components/ui/shared/media';
import FightRow from '@/components/ui/fights/fight-row';
import EmptyState from '@/components/ui/shared/empty-state';

export default async function Page({ params }: { params: { slug: string } }) {
  const event = await fetchEventById(params.slug);

  if (!event) {
    notFound();
  }

  const fights = await fetchFightsByEvent(params.slug);

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
        <div className="flex flex-col gap-3">
          {fights.map((fight) => (
            <FightRow key={fight.id} fight={fight} />
          ))}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 3: Delete the now-unused client component it replaces**

```bash
git rm components/ui/fights/fights-by-event.tsx
```

- [ ] **Step 4: Add loading and error states**

```tsx
// app/events/[slug]/loading.tsx
export default function Loading() {
  return (
    <main className="flex min-h-screen flex-col gap-6 p-6">
      <div className="h-20 animate-pulse rounded-lg border border-base-border bg-base-card" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-20 animate-pulse rounded-lg border border-base-border bg-base-card" />
        ))}
      </div>
    </main>
  );
}
```

```tsx
// app/events/[slug]/error.tsx
'use client';

import ErrorState from '@/components/ui/shared/error-state';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <ErrorState title="Impossible de charger cet événement" />
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

- [ ] **Step 5: Verify manually**

Run: `npm run dev`, open `http://localhost:3000`, navigate Organisation → an event.
Expected: no fighter-by-fighter network waterfall in the browser's Network tab (one server render, no client-side `/api/fighter/*` calls), fights shown as face-to-face rows instead of the old circular avatar list.

- [ ] **Step 6: Commit**

```bash
git add app/events components/ui/fights
git commit -m "refactor(events): convert event page to Server Component, replace avatar list with fight rows"
```

---

### Task 11: Fighters index page (new) — grid + org filter

**Files:**
- Create: `app/fighters/page.tsx`
- Create: `components/ui/fighters/fighters-grid.tsx`
- Create: `app/fighters/loading.tsx`
- Create: `app/fighters/error.tsx`

- [ ] **Step 1: Create the client-side filtering grid (data is fetched once on the server; the org dropdown just filters the already-loaded array — no extra network request)**

```tsx
// components/ui/fighters/fighters-grid.tsx
'use client';

import { useMemo, useState } from 'react';
import FighterCard from './fighter-card';
import EmptyState from '@/components/ui/shared/empty-state';
import { FighterWithOrganization, Organization } from '@/data/lib/definitions';

export default function FightersGrid({
  fighters,
  organizations,
}: {
  fighters: FighterWithOrganization[];
  organizations: Organization[];
}) {
  const [selectedOrgId, setSelectedOrgId] = useState<string>('all');

  const filteredFighters = useMemo(() => {
    if (selectedOrgId === 'all') return fighters;
    return fighters.filter((fighter) => String(fighter.organization_id) === selectedOrgId);
  }, [fighters, selectedOrgId]);

  return (
    <div className="flex flex-col gap-4">
      <select
        value={selectedOrgId}
        onChange={(event) => setSelectedOrgId(event.target.value)}
        className="w-fit rounded-md border border-base-border bg-base-card px-3 py-2 text-sm text-ink-primary"
      >
        <option value="all">Toutes les organisations</option>
        {organizations.map((organization) => (
          <option key={organization.id} value={String(organization.id)}>
            {organization.abbreviation}
          </option>
        ))}
      </select>
      {filteredFighters.length === 0 ? (
        <EmptyState title="Aucun combattant dans cette catégorie" />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {filteredFighters.map((fighter) => (
            <FighterCard key={fighter.id} fighter={fighter} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create the page**

```tsx
// app/fighters/page.tsx
import { fetchAllFighters, fetchOrganizations } from '@/data/lib/data';
import FightersGrid from '@/components/ui/fighters/fighters-grid';

export default async function Page() {
  const [fighters, organizations] = await Promise.all([
    fetchAllFighters(),
    fetchOrganizations(),
  ]);

  return (
    <main className="flex min-h-screen flex-col gap-6 p-6">
      <h1 className="font-display text-2xl uppercase tracking-wide text-ink-primary">Fighters</h1>
      <FightersGrid fighters={fighters} organizations={organizations} />
    </main>
  );
}
```

- [ ] **Step 3: Add loading and error states**

```tsx
// app/fighters/loading.tsx
import CardGridSkeleton from '@/components/ui/shared/card-grid-skeleton';

export default function Loading() {
  return (
    <main className="flex min-h-screen flex-col gap-6 p-6">
      <CardGridSkeleton />
    </main>
  );
}
```

```tsx
// app/fighters/error.tsx
'use client';

import ErrorState from '@/components/ui/shared/error-state';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <ErrorState title="Impossible de charger les combattants" />
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

- [ ] **Step 4: Verify manually**

Run: `npm run dev`, open `http://localhost:3000/fighters`.
Expected: grid of fighter cards (portrait, name, org, weight class, record). Changing the organization dropdown filters instantly with no network request (check the Network tab — no new requests fire on selection change).

- [ ] **Step 5: Commit**

```bash
git add app/fighters/page.tsx app/fighters/loading.tsx app/fighters/error.tsx components/ui/fighters/fighters-grid.tsx
git commit -m "feat(fighters): add fighters index page with client-side org filter"
```

---

### Task 12: Fighter profile page (new) — stats + history

**Files:**
- Create: `app/fighters/[slug]/page.tsx`
- Create: `components/ui/fighters/fighter-history-list.tsx`
- Create: `app/fighters/[slug]/loading.tsx`
- Create: `app/fighters/[slug]/error.tsx`

- [ ] **Step 1: Create the fight history list**

```tsx
// components/ui/fighters/fighter-history-list.tsx
import Link from 'next/link';
import { FightHistoryEntry } from '@/data/lib/definitions';

const resultLabel: Record<FightHistoryEntry['result'], string> = {
  win: 'Victoire',
  loss: 'Défaite',
  draw: 'Nul',
  upcoming: 'À venir',
};

export default function FighterHistoryList({ fights }: { fights: FightHistoryEntry[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {fights.map((fight) => (
        <li key={fight.id}>
          <Link
            href={`/events/${fight.event_id}`}
            className="flex items-center justify-between rounded-lg border border-base-border bg-base-card p-3 hover:border-accent"
          >
            <div>
              <p className="text-sm text-ink-primary">vs {fight.opponent_name}</p>
              <p className="text-xs text-ink-secondary">
                {fight.event_name} · {fight.event_date}
              </p>
            </div>
            <span className="font-display text-xs uppercase tracking-wide text-accent">
              {resultLabel[fight.result]}
              {fight.result === 'win' && fight.method ? ` · ${fight.method}` : ''}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: Create the page**

```tsx
// app/fighters/[slug]/page.tsx
import { notFound } from 'next/navigation';
import { fetchFighterById, fetchFightsByFighterId } from '@/data/lib/data';
import { computeFighterStats } from '@/data/lib/fighter-stats';
import { CoverImage } from '@/components/ui/shared/media';
import FighterHistoryList from '@/components/ui/fighters/fighter-history-list';
import EmptyState from '@/components/ui/shared/empty-state';

export default async function Page({ params }: { params: { slug: string } }) {
  const fighter = await fetchFighterById(params.slug);

  if (!fighter) {
    notFound();
  }

  const fights = await fetchFightsByFighterId(params.slug);
  const stats = computeFighterStats(fights);

  return (
    <main className="flex min-h-screen flex-col gap-6 p-6">
      <div className="relative h-24 overflow-hidden rounded-t-lg bg-base-card">
        <CoverImage
          src={fighter.image_url}
          alt={fighter.name}
          className="absolute -bottom-6 left-4 h-16 w-16 rounded-lg border-2 border-base-bg"
        />
      </div>
      <div className="pl-4">
        <p className="font-display text-xs uppercase tracking-wide text-accent">
          {fighter.organization_abbreviation} · {fighter.weight_class}
        </p>
        <h1 className="font-display text-2xl uppercase tracking-wide text-ink-primary">{fighter.name}</h1>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <StatBox label="Wins" value={stats.wins} />
        <StatBox label="Losses" value={stats.losses} />
        <StatBox label="KO" value={stats.ko} />
      </div>
      <div>
        <h2 className="mb-3 font-display text-sm uppercase tracking-wide text-ink-secondary">Historique</h2>
        {fights.length === 0 ? (
          <EmptyState title="Aucun combat enregistré" />
        ) : (
          <FighterHistoryList fights={fights} />
        )}
      </div>
    </main>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-base-border bg-base-card p-3 text-center">
      <p className="font-display text-xl text-ink-primary">{value}</p>
      <p className="text-xs uppercase tracking-wide text-ink-secondary">{label}</p>
    </div>
  );
}
```

- [ ] **Step 3: Add loading and error states**

```tsx
// app/fighters/[slug]/loading.tsx
export default function Loading() {
  return (
    <main className="flex min-h-screen flex-col gap-6 p-6">
      <div className="h-24 animate-pulse rounded-lg border border-base-border bg-base-card" />
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-16 animate-pulse rounded-lg border border-base-border bg-base-card" />
        ))}
      </div>
    </main>
  );
}
```

```tsx
// app/fighters/[slug]/error.tsx
'use client';

import ErrorState from '@/components/ui/shared/error-state';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <ErrorState title="Impossible de charger ce combattant" />
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

- [ ] **Step 4: Verify manually**

Run: `npm run dev`, open `http://localhost:3000/fighters`, click a fighter card.
Expected: profile header with portrait, org/weight class, name; a 3-box stats row (Wins/Losses/KO); a fight history list below linking back to each event. Visiting `http://localhost:3000/fighters/999999` shows Next's default 404 page.

- [ ] **Step 5: Commit**

```bash
git add app/fighters/[slug] components/ui/fighters/fighter-history-list.tsx
git commit -m "feat(fighters): add fighter profile page with stats and fight history"
```

---

## Out of scope (handled by other workstreams)

- `@vercel/postgres` → Neon migration (chantier 1)
- UFC/Bellator scraping + full seed reactivation (chantier 2)
- React Native / Expo mobile app (chantier 4)
- `pages/api/*` routes are left untouched — they'll be reused as the JSON API for the future mobile app
