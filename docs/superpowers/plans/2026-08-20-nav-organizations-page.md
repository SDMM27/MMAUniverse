# Nav Globale + Page Organisations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 4th nav link ("Organisations" → `/organizations`) and build that page as a Server Component listing every organization with its next event, reusing components/utilities left in place for exactly this purpose after the Home redesign — then remove the now-stale "reserved for later" comments those pieces were left with.

**Architecture:** One new route (`app/organizations/page.tsx`) that fetches organizations + events and reuses `computeNextEventByOrg` (data/lib/event-utils.ts) and `OrganizationsList`/`OrganizationCard` (components/ui/organizations/) unchanged. No new data-fetching functions, no new components — this task is pure wiring plus two doc-comment cleanups.

**Tech Stack:** Next.js 14 App Router (Server Components), TypeScript, Tailwind (Dark Combat palette).

**Testing note:** Consistent with the rest of this codebase (see prior plans/specs), there are no automated tests for pages or components. Verification is `npx tsc --noEmit` plus manual browser checks against the real dev server + seeded DB.

---

### Task 1: Add the nav link

**Files:**
- Modify: `components/ui/nav.tsx`

- [ ] **Step 1: Add the "Organisations" link**

In `components/ui/nav.tsx`, the `links` array is currently:

```ts
const links = [
  { href: '/', label: 'Home' },
  { href: '/events', label: 'Events' },
  { href: '/fighters', label: 'Fighters' },
];
```

Change it to:

```ts
const links = [
  { href: '/', label: 'Home' },
  { href: '/events', label: 'Events' },
  { href: '/fighters', label: 'Fighters' },
  { href: '/organizations', label: 'Organisations' },
];
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/ui/nav.tsx
git commit -m "feat(nav): add Organisations link

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

(The link will 404 until Task 2 creates the page — that's fine, it lands in the same short-lived branch before merge. If you want to double check, that's expected and gets fixed by the very next task, not a bug to report.)

---

### Task 2: Create the `/organizations` list page

**Files:**
- Create: `app/organizations/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
import { fetchAllEvents, fetchOrganizations } from '@/data/lib/data';
import { computeNextEventByOrg } from '@/data/lib/event-utils';
import OrganizationsList from '@/components/ui/organizations/organizations-list';
import EmptyState from '@/components/ui/shared/empty-state';

// Queries the DB on every request instead of at build time — Vercel's build
// step doesn't reliably have DATABASE_URL / DB access yet (see data/lib/db.ts).
export const dynamic = 'force-dynamic';

export default async function Page() {
  const [organizations, events] = await Promise.all([fetchOrganizations(), fetchAllEvents()]);

  if (organizations.length === 0) {
    return (
      <main className="flex min-h-screen flex-col gap-8 p-6">
        <EmptyState title="Aucune organisation pour le moment" />
      </main>
    );
  }

  const nextByOrg = computeNextEventByOrg(events);

  const organizationsWithActivity = organizations.map((organization) => {
    const orgNext = nextByOrg.get(organization.id);
    return {
      ...organization,
      nextEvent: orgNext ? { ...orgNext.event, isUpcoming: orgNext.isUpcoming } : undefined,
      eventCount: orgNext?.eventCount ?? 0,
    };
  });

  return (
    <main className="flex min-h-screen flex-col gap-8 p-6">
      <h1 className="font-display text-lg uppercase tracking-wide text-ink-primary">
        Organisations ({organizations.length})
      </h1>
      <OrganizationsList organizations={organizationsWithActivity} />
    </main>
  );
}
```

This is the exact `organizationsWithActivity` construction that used to live in `app/page.tsx` before the Home redesign — same shape, same fields, just relocated to its own route with its own page-level `<h1>` instead of a `<h2>` section heading (there's no hero above it here, so the page title is the top-level heading).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual verification**

Start the dev server:

```bash
npm run dev
```

Open `http://localhost:3000/organizations` (and also click "Organisations" from the nav on any page) and confirm:
- Page title reads "Organisations (N)" with the correct count.
- A grid of organization cards renders, each showing logo, abbreviation, name, and either "Prochain"/"Dernier" + event name/date, or "Aucun événement" if the org has none.
- Clicking a card navigates to `/organizations/[id]` (existing, unchanged detail page) and shows that organization's events.
- No console errors.

- [ ] **Step 4: Commit**

```bash
git add app/organizations/page.tsx
git commit -m "feat(organizations): add organizations list page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Clean up the "reserved for later" comments

**Files:**
- Modify: `data/lib/event-utils.ts:33-38`
- Modify: `components/ui/organizations/organizations-list.tsx:3-4`

Both of these were annotated during the Home redesign as unused/reserved for this exact page. Now that Task 2 wires them in, those comments are stale and should be corrected.

- [ ] **Step 1: Fix the `computeNextEventByOrg` docstring**

In `data/lib/event-utils.ts`, the docstring currently reads:

```ts
/**
 * Per-organization version of computeNextEvent, plus a total count of events
 * on file for that org. Not currently called anywhere; kept for a planned
 * future `/organizations` list page (see docs/superpowers/specs/
 * 2026-08-20-home-editorial-redesign-design.md).
 */
export function computeNextEventByOrg<T extends Event & { organization_abbreviation: string }>(
```

Change the docstring to:

```ts
/**
 * Per-organization version of computeNextEvent, plus a total count of events
 * on file for that org. Used by the /organizations list page so each
 * organization card can show what's actually coming up there instead of
 * just its logo.
 */
export function computeNextEventByOrg<T extends Event & { organization_abbreviation: string }>(
```

(Only the comment block changes — the function signature and body are untouched.)

- [ ] **Step 2: Remove the stale comment from `OrganizationsList`**

In `components/ui/organizations/organizations-list.tsx`, the file currently starts with:

```tsx
import OrganizationCard, { OrganizationWithActivity } from './organization-card';

// Not currently rendered anywhere (home page was redesigned to remove organization
// cards). Reserved for a planned future `/organizations` list page.
export default function OrganizationsList({
```

Change it to:

```tsx
import OrganizationCard, { OrganizationWithActivity } from './organization-card';

export default function OrganizationsList({
```

(Just delete the two comment lines and the blank line stays as the single separator between the import and the export — i.e. one blank line between them, not two.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (comment-only changes).

- [ ] **Step 4: Commit**

```bash
git add data/lib/event-utils.ts components/ui/organizations/organizations-list.tsx
git commit -m "docs: update comments now that computeNextEventByOrg and OrganizationsList are wired up

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Final full-flow verification

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Run the existing test suite**

Run: `npm test`
Expected: all 20 existing tests in `data/lib/*.test.ts` still pass (this feature didn't touch any tested file).

- [ ] **Step 3: Full manual pass**

With `npm run dev` running, in the browser:
- Confirm the nav shows all 4 links (Home, Events, Fighters, Organisations) on every page, in that order.
- Load `/organizations` directly and via the nav link — confirm the grid renders as checked in Task 2.
- Click into an organization card → confirm `/organizations/[id]` still works exactly as before (unchanged by this plan).
- Confirm `/`, `/events`, `/fighters` are unaffected (this plan didn't touch their pages, only the shared nav component which now has one more link).

No commit for this task — it's verification only.
