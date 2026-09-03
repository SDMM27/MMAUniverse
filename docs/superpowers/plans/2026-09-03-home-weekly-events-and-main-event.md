# Home: "Cette semaine" section + main-event-only hero fight — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On both the web home (`/`) and the mobile home tab, show only the hero event's main fight (not its whole card), and add a "Cette semaine" section listing this week's other events across all organizations.

**Architecture:** Reuse existing pure helpers (`groupUpcomingByWeek`, `splitEventsByStatus` in `data/lib/event-utils.ts`) and existing components (`EventCard` web/mobile, `FightCard` web/mobile) — no new pure functions, no schema change. The web page computes everything itself (it already fetches events server-side); the mobile home gets the same data pre-computed from `app/api/mobile/home/route.ts` since the mobile app only ever sees that route's JSON, never server code directly.

**Tech Stack:** Next.js 14 App Router (web), Expo Router + React Native (mobile), TypeScript, `node:test` for the one existing pure-function test suite (unaffected by this plan — no new pure functions are introduced).

**Design doc:** [docs/superpowers/specs/2026-09-03-home-weekly-events-and-main-event-design.md](../specs/2026-09-03-home-weekly-events-and-main-event-design.md)

---

### Task 1: Web home — hero section shows only the main fight

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Replace the "Combats à venir" block with a single-fight "Combat principal" block**

In `app/page.tsx`, the current file (88 lines) has this import block at the top:

```tsx
import Link from 'next/link';
import { fetchAllEvents, fetchFightsByEvent, fetchRecentFinishedFights } from '@/data/lib/data';
import { computeNextEventForHome } from '@/data/lib/event-utils';
import { splitMainEvent } from '@/data/lib/fight-utils';
import NextEventHero from '@/components/ui/events/next-event-hero';
import FightCard from '@/components/ui/fights/fight-card';
import FightRow from '@/components/ui/fights/fight-row';
import FightResultRow from '@/components/ui/fights/fight-result-row';
import EmptyState from '@/components/ui/shared/empty-state';
```

Replace it with (drops the now-unused `splitMainEvent` and `FightRow` imports):

```tsx
import Link from 'next/link';
import { fetchAllEvents, fetchFightsByEvent, fetchRecentFinishedFights } from '@/data/lib/data';
import { computeNextEventForHome } from '@/data/lib/event-utils';
import NextEventHero from '@/components/ui/events/next-event-hero';
import FightCard from '@/components/ui/fights/fight-card';
import FightResultRow from '@/components/ui/fights/fight-result-row';
import EmptyState from '@/components/ui/shared/empty-state';
```

Then, a few lines above, this comment is now stale (it still refers to the "Combats à venir" section listing multiple fights):

```tsx
  // Fetched unconditionally (not just when isUpcoming) because the hero now
  // builds its visual from the main-event fighters' photos rather than
  // Sherdog's event poster — see NextEventHero. The "Combats à venir" section
  // below still only lists fights for an actually-upcoming hero event: when
  // there's no future event in DB, computeNextEventForHome falls back to
  // the last past event, which has nothing left "à venir" to show there.
```

Update it to match the new section name and single-fight behavior:

```tsx
  // Fetched unconditionally (not just when isUpcoming) because the hero now
  // builds its visual from the main-event fighters' photos rather than
  // Sherdog's event poster — see NextEventHero. The "Combat principal" section
  // below still only shows a fight for an actually-upcoming hero event: when
  // there's no future event in DB, computeNextEventForHome falls back to
  // the last past event, which has no upcoming fight left to show there.
```

Then, inside `Page()`, this block:

```tsx
  const { mainEvent, rest } = splitMainEvent(nextEventFights);
  const heroEvent = next && next.isUpcoming ? next.event : null;
  const heroFights = heroEvent ? nextEventFights : [];

  // The hero's matchup visual can't use `mainEvent` above: is_main_event is
  // never actually set to true anywhere in the scrapers/seed, so it's always
  // null in practice. Falling back to the first fetched fight instead — it's
  // the same fight already shown first in "Combats à venir" below.
  const heroFight = nextEventFights[0] ?? null;
```

becomes:

```tsx
  const heroEvent = next && next.isUpcoming ? next.event : null;

  // is_main_event is never actually set to true anywhere in the
  // scrapers/seed, so there's no reliable flag to pick "the" main event out
  // of nextEventFights. fetchFightsByEvent orders by `is_main_event DESC,
  // id ASC` (see data/lib/data.ts), so the first fetched fight is the
  // closest thing to a main event the data supports today — used both for
  // the hero's fighter photos and for the "Combat principal" card below.
  const heroFight = nextEventFights[0] ?? null;
```

And this section:

```tsx
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
```

becomes:

```tsx
      {heroFight && heroEvent && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg uppercase tracking-wide text-ink-primary">Combat principal</h2>
            <Link href={`/events/${heroEvent.id}`} className="text-xs uppercase tracking-wide text-accent hover:underline">
              Voir l&apos;événement
            </Link>
          </div>
          <FightCard fight={heroFight} event={heroEvent} />
        </section>
      )}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (in particular, no "unused import" or "cannot find name `mainEvent`/`rest`/`heroFights`" errors — `next lint` also flags unused imports if `tsc` doesn't).

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat(home): show only the main fight under the hero event

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Web home — "Cette semaine" section

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Add the imports for the week computation and `EventCard`**

This builds on Task 1's import block. Change:

```tsx
import { computeNextEventForHome } from '@/data/lib/event-utils';
import NextEventHero from '@/components/ui/events/next-event-hero';
import FightCard from '@/components/ui/fights/fight-card';
import FightResultRow from '@/components/ui/fights/fight-result-row';
import EmptyState from '@/components/ui/shared/empty-state';
```

to:

```tsx
import { computeNextEventForHome, groupUpcomingByWeek, splitEventsByStatus } from '@/data/lib/event-utils';
import NextEventHero from '@/components/ui/events/next-event-hero';
import FightCard from '@/components/ui/fights/fight-card';
import FightResultRow from '@/components/ui/fights/fight-result-row';
import EventCard from '@/components/ui/events/event-card';
import EmptyState from '@/components/ui/shared/empty-state';
```

- [ ] **Step 2: Compute `weeklyEvents` inside `Page()`**

Right after the `heroFight` assignment from Task 1 (still inside `Page()`, before the `return`), add:

```tsx
  const { upcoming } = splitEventsByStatus(events);
  const { thisWeek } = groupUpcomingByWeek(upcoming);
  // The hero's own event already gets its own spotlight above — don't list
  // it a second time here.
  const weeklyEvents = thisWeek.filter((event) => event.id !== heroEvent?.id);
```

- [ ] **Step 3: Render the section between "Combat principal" and "Derniers résultats"**

Insert this block right after the `{heroFight && heroEvent && ( ... )}` section from Task 1, and before the `{recentResults.length > 0 && ( ... )}` section:

```tsx
      {weeklyEvents.length > 0 && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg uppercase tracking-wide text-ink-primary">Cette semaine</h2>
            <Link href="/events" className="text-xs uppercase tracking-wide text-accent hover:underline">
              Voir tous les événements
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {weeklyEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      )}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx
git commit -m "feat(home): add a \"Cette semaine\" section for the current week's events

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Mobile API — expose `weeklyEvents` from `/api/mobile/home`

**Files:**
- Modify: `app/api/mobile/home/route.ts`

- [ ] **Step 1: Compute and return `weeklyEvents`**

Current file:

```ts
import { NextResponse } from 'next/server';
import { fetchAllEvents, fetchOrganizations, fetchFightsByEvent } from '@/data/lib/data';
import { computeNextEventForHome } from '@/data/lib/event-utils';

// Required: @neondatabase/serverless issues queries as fetch() calls, which Next.js
// would otherwise cache as static route data.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [events, organizations] = await Promise.all([fetchAllEvents(), fetchOrganizations()]);
    const nextEvent = computeNextEventForHome(events);
    const fights = nextEvent && nextEvent.isUpcoming ? await fetchFightsByEvent(String(nextEvent.event.id)) : [];
    return NextResponse.json({ nextEvent, organizations, fights });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Failed to fetch home data' }, { status: 500 });
  }
}
```

Replace it entirely with:

```ts
import { NextResponse } from 'next/server';
import { fetchAllEvents, fetchOrganizations, fetchFightsByEvent } from '@/data/lib/data';
import { computeNextEventForHome, groupUpcomingByWeek, splitEventsByStatus } from '@/data/lib/event-utils';

// Required: @neondatabase/serverless issues queries as fetch() calls, which Next.js
// would otherwise cache as static route data.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [events, organizations] = await Promise.all([fetchAllEvents(), fetchOrganizations()]);
    const nextEvent = computeNextEventForHome(events);
    const fights = nextEvent && nextEvent.isUpcoming ? await fetchFightsByEvent(String(nextEvent.event.id)) : [];

    // Same "this week, minus whatever's already the hero" set the web home
    // shows in its "Cette semaine" section (see app/page.tsx) — computed
    // here rather than on-device because the mobile app only ever sees
    // this route's JSON, not data/lib/event-utils.ts directly.
    const { upcoming } = splitEventsByStatus(events);
    const { thisWeek } = groupUpcomingByWeek(upcoming);
    const heroEventId = nextEvent && nextEvent.isUpcoming ? nextEvent.event.id : null;
    const weeklyEvents = thisWeek.filter((event) => event.id !== heroEventId);

    return NextResponse.json({ nextEvent, organizations, fights, weeklyEvents });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Failed to fetch home data' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/mobile/home/route.ts
git commit -m "feat(mobile-api): include this week's events in the home payload

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Mobile types — add `weeklyEvents` to `HomeResponse`

**Files:**
- Modify: `mobile/lib/types.ts`

- [ ] **Step 1: Extend `HomeResponse`**

Current:

```ts
export type HomeResponse = {
  nextEvent: NextEventPayload;
  organizations: Organization[];
  fights: FightWithFighters[];
};
```

Replace with:

```ts
export type HomeResponse = {
  nextEvent: NextEventPayload;
  organizations: Organization[];
  fights: FightWithFighters[];
  weeklyEvents: EventWithOrganization[];
};
```

(`EventWithOrganization` is already defined earlier in this same file — no new import needed.)

- [ ] **Step 2: Typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: no errors yet from this file alone (Task 5 is what actually consumes the new field — this step just confirms the type edit itself doesn't break anything already using `HomeResponse`).

- [ ] **Step 3: Commit**

```bash
git add mobile/lib/types.ts
git commit -m "feat(mobile): add weeklyEvents to the HomeResponse type

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Mobile home screen — fix main-event fight, add "Cette semaine"

**Files:**
- Modify: `mobile/app/(tabs)/index.tsx`

- [ ] **Step 1: Replace the whole file**

Current file (`mobile/app/(tabs)/index.tsx`, 59 lines) relies on `splitMainEvent(fights).mainEvent`, which is always `null` in practice (see design doc) — the main-event `FightCard` never actually renders today. Replace the entire file with:

```tsx
import { View, Text, ScrollView, Image, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { getHome } from '../../lib/api';
import { useApi } from '../../lib/use-api';
import { Loading, ErrorState, EmptyState } from '../../components/state';
import { OrganizationCard, FightCard, EventCard } from '../../components/cards';

export default function HomeScreen() {
  const router = useRouter();
  const [state, reload] = useApi(getHome, []);

  if (state.status === 'loading') return <Loading />;
  if (state.status === 'error') return <ErrorState message={state.message} onRetry={reload} />;

  const { nextEvent, organizations, fights, weeklyEvents } = state.data;
  // is_main_event is never actually set to true anywhere in the
  // scrapers/seed, so there's no reliable flag to pick "the" main event out
  // of `fights`. The API orders fights `is_main_event DESC, id ASC` (see
  // data/lib/data.ts), so the first fetched fight is the closest thing to a
  // main event the data supports today.
  const mainEvent = fights[0] ?? null;

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

      {weeklyEvents.length > 0 && (
        <View className="gap-3">
          <Text className="font-display text-lg uppercase text-ink-primary">Cette semaine</Text>
          {weeklyEvents.map((event) => (
            <EventCard key={event.id} event={event} onPress={() => router.push(`/events/${event.id}`)} />
          ))}
        </View>
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

Note this drops the `import { splitMainEvent } from '../../lib/fight-utils';` line entirely — `splitMainEvent` stays defined in `mobile/lib/fight-utils.ts` for the event-detail screen (`mobile/app/(tabs)/events/[id].tsx`), just no longer imported here.

- [ ] **Step 2: Typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "mobile/app/(tabs)/index.tsx"
git commit -m "feat(mobile): show the main fight and this week's events on home

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Start the web dev server and open the home page**

Use the `mma-universe-dev` launch config (`.claude/launch.json`, already present — `npm run dev` on port 3000) to open `/` in the browser preview.

Check:
- A "Combat principal" section appears with exactly one `FightCard` (not a list of `FightRow`s below it).
- If there are other events in the current ISO week besides the hero's, a "Cette semaine" section appears between "Combat principal" and "Derniers résultats", rendered as a grid of `EventCard`s, and it does **not** include the hero's own event.
- If there are no other events this week, the "Cette semaine" section is absent entirely (no empty heading).
- "Derniers résultats" is unchanged.

Also check the browser console (`read_console_messages`) for no new errors, and `read_network_requests` for the page's own request succeeding (200).

- [ ] **Step 2: Verify the mobile API payload directly**

With the dev server running, fetch the JSON the mobile app will consume:

```bash
curl -s http://localhost:3000/api/mobile/home | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('weeklyEvents:', d.weeklyEvents.map(e=>e.id)); console.log('nextEvent id:', d.nextEvent && d.nextEvent.event.id); console.log('fights[0] id:', d.fights[0] && d.fights[0].id);"
```

Expected: `weeklyEvents` is present and never contains `nextEvent.event.id`; `fights[0]` is present whenever `nextEvent.isUpcoming` is true.

- [ ] **Step 3: Start the mobile web preview**

Use the `mobile-web` launch config (`.claude/launch.json`, already present — `expo start --web` on port 8081).

Note: `mobile/.env` currently points `EXPO_PUBLIC_API_URL` at a LAN IP (`http://192.168.1.26:3000`), not `localhost`. If the mobile web preview can't reach that address from this environment, skip the visual check and rely on Task 4/5's `tsc --noEmit` passes plus Step 2's payload check above as sufficient verification — do not edit `mobile/.env` as part of this plan (out of scope, and it may be intentionally set for on-device testing).

If reachable, check:
- The home screen's `FightCard` (main event) now renders under the hero (it did not before this plan).
- A "Cette semaine" list appears above "Organisations" when `weeklyEvents` is non-empty, absent otherwise.

- [ ] **Step 4: Run the existing unit test suite as a regression check**

Run: `npm test`
Expected: all existing tests in `data/**/*.test.ts` still pass (this plan doesn't touch any of the pure functions they cover — `groupUpcomingByWeek`, `splitEventsByStatus`, `computeNextEventForHome`, `splitMainEvent`, etc. are all reused unchanged).

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: no new warnings/errors from the files touched in Tasks 1–3.
