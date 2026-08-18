# App mobile (chantier 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a read-only Expo mobile app (iOS + Android via Expo Go) that mirrors the web site's content — organizations, events, fighters — backed by new JSON API routes on the existing Next.js project.

**Architecture:** New App Router route handlers under `app/api/mobile/**` wrap the existing `data/lib/data.ts` query functions (no new SQL) and replace the obsolete `pages/api/*` routes. A new standalone Expo project in `mobile/` (Expo Router, NativeWind, TypeScript) consumes those routes over `fetch`, with 4 bottom tabs — Home / Events / Fighters / Orgs — each with its own navigation stack for list → detail.

**Tech Stack:** Next.js 14 App Router (API layer), Expo + Expo Router + NativeWind + TypeScript (mobile app), `@expo-google-fonts/oswald` for the display font.

---

## File Structure

**Next.js side (this repo, existing project):**
- Delete: `pages/api/event/[slug].js`, `pages/api/events/[slug].js`, `pages/api/fighter/[slug].js`, `pages/api/fights/[slug].js`, `pages/api/orgs/[slug].js`
- Create: `app/api/mobile/orgs/route.ts`, `app/api/mobile/orgs/[slug]/route.ts`
- Create: `app/api/mobile/events/route.ts`, `app/api/mobile/events/[slug]/route.ts`
- Create: `app/api/mobile/fighters/route.ts`, `app/api/mobile/fighters/[slug]/route.ts`
- Create: `app/api/mobile/home/route.ts`

**Mobile side (new `mobile/` Expo project):**
- `mobile/app/_layout.tsx` — root layout, loads Oswald, hosts the `(tabs)` stack
- `mobile/app/(tabs)/_layout.tsx` — bottom tab navigator
- `mobile/app/(tabs)/index.tsx` — Home
- `mobile/app/(tabs)/orgs/index.tsx`, `mobile/app/(tabs)/orgs/[id].tsx`
- `mobile/app/(tabs)/events/index.tsx`, `mobile/app/(tabs)/events/[id].tsx`
- `mobile/app/(tabs)/fighters/index.tsx`, `mobile/app/(tabs)/fighters/[id].tsx`
- `mobile/lib/types.ts` — response shapes (mirrors `data/lib/definitions.ts`)
- `mobile/lib/api.ts` — fetch client, one function per route
- `mobile/lib/use-api.ts` — shared loading/error/retry data-fetching hook
- `mobile/components/state.tsx` — `Loading`, `EmptyState`, `ErrorState`
- `mobile/components/cards.tsx` — `OrganizationCard`, `EventCard`, `FighterCard`, `FightRow`
- `mobile/tailwind.config.js`, `mobile/global.css`, `mobile/babel.config.js`, `mobile/metro.config.js` — Dark Combat tokens via NativeWind
- `mobile/.env` (gitignored, per-developer) / `mobile/.env.example` (committed)

---

## Task 1: Remove obsolete `pages/api/*` routes

**Files:**
- Delete: `pages/api/event/[slug].js`
- Delete: `pages/api/events/[slug].js`
- Delete: `pages/api/fighter/[slug].js`
- Delete: `pages/api/fights/[slug].js`
- Delete: `pages/api/orgs/[slug].js`

- [ ] **Step 1: Confirm nothing imports these routes**

API routes are hit over HTTP, not imported — but confirm no stray import slipped in:

Run: `grep -rn "pages/api" --include="*.ts" --include="*.tsx" app components data`
Expected: no output.

- [ ] **Step 2: Delete the 5 files**

```bash
rm "pages/api/event/[slug].js" "pages/api/events/[slug].js" "pages/api/fighter/[slug].js" "pages/api/fights/[slug].js" "pages/api/orgs/[slug].js"
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors (these were `.js` files, untyped — removing them can't introduce type errors).

- [ ] **Step 4: Commit**

```bash
git add pages/api
git commit -m "chore(api): remove obsolete pages/api routes, replaced by app/api/mobile"
```

---

## Task 2: Organizations API — `app/api/mobile/orgs`

**Files:**
- Create: `app/api/mobile/orgs/route.ts`
- Create: `app/api/mobile/orgs/[slug]/route.ts`

- [ ] **Step 1: Write the list route**

```ts
// app/api/mobile/orgs/route.ts
import { NextResponse } from 'next/server';
import { fetchOrganizations } from '@/data/lib/data';

export const dynamic = 'force-dynamic';

export async function GET() {
  const organizations = await fetchOrganizations();
  return NextResponse.json(organizations);
}
```

- [ ] **Step 2: Write the detail route**

```ts
// app/api/mobile/orgs/[slug]/route.ts
import { NextResponse } from 'next/server';
import { fetchOrganizationById, fetchEventsByOrg } from '@/data/lib/data';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { slug: string } }) {
  const organization = await fetchOrganizationById(params.slug);

  if (!organization) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }

  const events = await fetchEventsByOrg(params.slug);
  return NextResponse.json({ organization, events });
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/mobile/orgs
git commit -m "feat(api): add /api/mobile/orgs list and detail routes"
```

---

## Task 3: Events API — `app/api/mobile/events`

**Files:**
- Create: `app/api/mobile/events/route.ts`
- Create: `app/api/mobile/events/[slug]/route.ts`

- [ ] **Step 1: Write the list route**

```ts
// app/api/mobile/events/route.ts
import { NextResponse } from 'next/server';
import { fetchAllEvents } from '@/data/lib/data';

export const dynamic = 'force-dynamic';

export async function GET() {
  const events = await fetchAllEvents();
  return NextResponse.json(events);
}
```

- [ ] **Step 2: Write the detail route**

```ts
// app/api/mobile/events/[slug]/route.ts
import { NextResponse } from 'next/server';
import { fetchEventById, fetchFightsByEvent } from '@/data/lib/data';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { slug: string } }) {
  const event = await fetchEventById(params.slug);

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const fights = await fetchFightsByEvent(params.slug);
  return NextResponse.json({ event, fights });
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/mobile/events
git commit -m "feat(api): add /api/mobile/events list and detail routes"
```

---

## Task 4: Fighters API — `app/api/mobile/fighters`

**Files:**
- Create: `app/api/mobile/fighters/route.ts`
- Create: `app/api/mobile/fighters/[slug]/route.ts`

- [ ] **Step 1: Write the list route**

```ts
// app/api/mobile/fighters/route.ts
import { NextResponse } from 'next/server';
import { fetchAllFighters } from '@/data/lib/data';

export const dynamic = 'force-dynamic';

export async function GET() {
  const fighters = await fetchAllFighters();
  return NextResponse.json(fighters);
}
```

- [ ] **Step 2: Write the detail route**

```ts
// app/api/mobile/fighters/[slug]/route.ts
import { NextResponse } from 'next/server';
import { fetchFighterById, fetchFightsByFighterId } from '@/data/lib/data';
import { computeFighterStats } from '@/data/lib/fighter-stats';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { slug: string } }) {
  const fighter = await fetchFighterById(params.slug);

  if (!fighter) {
    return NextResponse.json({ error: 'Fighter not found' }, { status: 404 });
  }

  const fights = await fetchFightsByFighterId(params.slug);
  const stats = computeFighterStats(fights);
  return NextResponse.json({ fighter, fights, stats });
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/mobile/fighters
git commit -m "feat(api): add /api/mobile/fighters list and detail routes"
```

---

## Task 5: Home API — `app/api/mobile/home`

**Files:**
- Create: `app/api/mobile/home/route.ts`

- [ ] **Step 1: Write the route**

```ts
// app/api/mobile/home/route.ts
import { NextResponse } from 'next/server';
import { fetchAllEvents, fetchOrganizations } from '@/data/lib/data';
import { computeNextEvent } from '@/data/lib/event-utils';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [events, organizations] = await Promise.all([fetchAllEvents(), fetchOrganizations()]);
  const nextEvent = computeNextEvent(events);
  return NextResponse.json({ nextEvent, organizations });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/mobile/home
git commit -m "feat(api): add /api/mobile/home route"
```

---

## Task 6: Manual verification of the API layer

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Verify each route with curl**

```bash
curl -s http://localhost:3000/api/mobile/orgs | head -c 300
curl -s http://localhost:3000/api/mobile/orgs/1 | head -c 300
curl -s http://localhost:3000/api/mobile/events | head -c 300
curl -s http://localhost:3000/api/mobile/fighters | head -c 300
curl -s http://localhost:3000/api/mobile/home | head -c 300
```

Expected: each returns `200` with real JSON (non-empty arrays for orgs/events/fighters — chantier 2 already seeded UFC/PFL/Bellator data). Note an `id` from the `events` and `fighters` responses for the next check.

- [ ] **Step 3: Verify the detail routes with a real id from Step 2**

```bash
curl -s http://localhost:3000/api/mobile/events/<id-from-step-2> | head -c 300
curl -s http://localhost:3000/api/mobile/fighters/<id-from-step-2> | head -c 300
```

Expected: `event`/`fights` and `fighter`/`fights`/`stats` respectively, not a 404.

- [ ] **Step 4: Verify a 404 on a bogus id**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/mobile/orgs/999999
```

Expected: `404`.

---

## Task 7: Scaffold the Expo project

**Files:**
- Create: `mobile/` (new Expo project)

- [ ] **Step 1: Create the project from the blank TypeScript template**

```bash
npx create-expo-app@latest mobile --template blank-typescript
cd mobile
```

- [ ] **Step 2: Install Expo Router and its peer dependencies**

```bash
npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar
```

- [ ] **Step 3: Point the app entry at Expo Router**

Edit `mobile/package.json`, change the `main` field:

```json
"main": "expo-router/entry",
```

- [ ] **Step 4: Add the deep-link scheme and dark UI style**

Edit `mobile/app.json`, inside `"expo"`:

```json
"scheme": "mmauniverse",
"userInterfaceStyle": "dark",
```

- [ ] **Step 5: Remove the template's default entry point**

```bash
rm App.tsx
```

- [ ] **Step 6: Create a minimal root layout and home placeholder**

```tsx
// mobile/app/_layout.tsx
import { Stack } from 'expo-router';

export default function RootLayout() {
  return <Stack />;
}
```

```tsx
// mobile/app/index.tsx
import { View, Text } from 'react-native';

export default function Index() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>MMA Universe mobile — router OK</Text>
    </View>
  );
}
```

- [ ] **Step 7: Verify manually**

Run: `npx expo start`
Expected: QR code printed. Scan it with Expo Go (iOS or Android) — the app opens showing "MMA Universe mobile — router OK".

- [ ] **Step 8: Commit**

```bash
cd ..
git add mobile
git commit -m "chore(mobile): scaffold Expo project with Expo Router"
```

---

## Task 8: Configure NativeWind with the Dark Combat tokens

**Files:**
- Create: `mobile/tailwind.config.js`
- Create: `mobile/global.css`
- Modify: `mobile/babel.config.js`
- Create: `mobile/metro.config.js`

- [ ] **Step 1: Install NativeWind and Tailwind**

```bash
cd mobile
npx expo install nativewind tailwindcss@3.4.17
```

- [ ] **Step 2: Write the Tailwind config with the Dark Combat tokens**

Same palette as the web project's `tailwind.config.ts`.

```js
// mobile/tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        base: {
          bg: '#0a0a0a',
          card: '#161616',
          border: '#262626',
        },
        accent: {
          DEFAULT: '#ff3b30',
        },
        ink: {
          primary: '#f5f5f5',
          secondary: '#9a9a9a',
        },
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 3: Write the global stylesheet**

```css
/* mobile/global.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 4: Update the Babel config**

```js
// mobile/babel.config.js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }]],
  };
};
```

- [ ] **Step 5: Write the Metro config**

```js
// mobile/metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: './global.css' });
```

- [ ] **Step 6: Import the stylesheet from the root layout and test a class**

```tsx
// mobile/app/_layout.tsx
import '../global.css';
import { Stack } from 'expo-router';

export default function RootLayout() {
  return <Stack />;
}
```

```tsx
// mobile/app/index.tsx
import { View, Text } from 'react-native';

export default function Index() {
  return (
    <View className="flex-1 items-center justify-center bg-base-bg">
      <Text className="text-ink-primary">MMA Universe mobile — NativeWind OK</Text>
    </View>
  );
}
```

- [ ] **Step 7: Verify manually**

Run: `npx expo start -c` (`-c` clears the Metro cache — required after a Babel/Metro config change)
Expected: in Expo Go, the screen background is near-black (`#0a0a0a`) and the text is off-white — confirms NativeWind classes are applying.

- [ ] **Step 8: Commit**

```bash
git add tailwind.config.js global.css babel.config.js metro.config.js app/_layout.tsx app/index.tsx package.json package-lock.json
git commit -m "feat(mobile): configure NativeWind with Dark Combat tokens"
```

---

## Task 9: Load the Oswald font

**Files:**
- Modify: `mobile/app/_layout.tsx`

- [ ] **Step 1: Install the font and splash screen packages**

```bash
npx expo install expo-font expo-splash-screen @expo-google-fonts/oswald
```

- [ ] **Step 2: Wire font loading into the root layout**

```tsx
// mobile/app/_layout.tsx
import '../global.css';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { useFonts, Oswald_400Regular, Oswald_700Bold } from '@expo-google-fonts/oswald';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Oswald_400Regular, Oswald_700Bold });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 3: Register the font family with NativeWind**

Edit `mobile/tailwind.config.js`, add inside `theme.extend`:

```js
      fontFamily: {
        display: ['Oswald_700Bold'],
      },
```

- [ ] **Step 4: Verify manually**

Run: `npx expo start -c`
Expected: app loads without a flash of unstyled content, splash screen dismisses once fonts are ready, no console errors about missing fonts.

- [ ] **Step 5: Commit**

```bash
git add app/_layout.tsx tailwind.config.js package.json package-lock.json
git commit -m "feat(mobile): load Oswald display font"
```

---

## Task 10: Shared response types — `mobile/lib/types.ts`

**Files:**
- Create: `mobile/lib/types.ts`

- [ ] **Step 1: Write the types, mirroring `data/lib/definitions.ts` and the API shapes from Tasks 2–5**

```ts
// mobile/lib/types.ts
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

export type EventWithOrganization = Event & {
  organization_abbreviation: string;
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

export type FighterWithOrganization = Fighter & {
  organization_abbreviation: string;
};

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
  fighter1: Fighter | null;
  fighter2: Fighter | null;
};

export type FightHistoryEntry = {
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
  opponent_name: string | null;
  opponent_image_url: string | null;
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

export type NextEventPayload = {
  event: EventWithOrganization;
  isUpcoming: boolean;
} | null;

export type HomeResponse = {
  nextEvent: NextEventPayload;
  organizations: Organization[];
};

export type OrgDetailResponse = {
  organization: Organization;
  events: Event[];
};

export type EventDetailResponse = {
  event: Event;
  fights: FightWithFighters[];
};

export type FighterDetailResponse = {
  fighter: FighterWithOrganization;
  fights: FightHistoryEntry[];
  stats: FighterStats;
};
```

- [ ] **Step 2: Commit**

```bash
git add lib/types.ts
git commit -m "feat(mobile): add shared API response types"
```

---

## Task 11: API client and data-fetching hook

**Files:**
- Create: `mobile/lib/api.ts`
- Create: `mobile/lib/use-api.ts`
- Create: `mobile/.env.example`
- Modify: `mobile/.gitignore`

- [ ] **Step 1: Add the env var placeholder**

```bash
# mobile/.env.example
EXPO_PUBLIC_API_URL=http://192.168.1.10:3000
```

- [ ] **Step 2: Gitignore the real `.env`**

Append to `mobile/.gitignore` (created by `create-expo-app`; add the line if missing):

```
.env
```

- [ ] **Step 3: Create the developer's real `.env`**

Find your machine's LAN IP (needed because a physical device running Expo Go can't reach your computer's `localhost`):

Run (Windows): `ipconfig` — look for "IPv4 Address" under your active adapter.

```bash
# mobile/.env — replace with the IP found above
EXPO_PUBLIC_API_URL=http://<your-lan-ip>:3000
```

- [ ] **Step 4: Write the API client**

```ts
// mobile/lib/api.ts
import type {
  Organization,
  EventWithOrganization,
  FighterWithOrganization,
  HomeResponse,
  OrgDetailResponse,
  EventDetailResponse,
  FighterDetailResponse,
} from './types';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

async function apiFetch<T>(path: string): Promise<T> {
  if (!API_URL) {
    throw new Error('EXPO_PUBLIC_API_URL is not set — add it to mobile/.env');
  }
  const response = await fetch(`${API_URL}${path}`);
  if (!response.ok) {
    throw new Error(`API request to ${path} failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function getHome() {
  return apiFetch<HomeResponse>('/api/mobile/home');
}

export function getOrgs() {
  return apiFetch<Organization[]>('/api/mobile/orgs');
}

export function getOrg(id: string) {
  return apiFetch<OrgDetailResponse>(`/api/mobile/orgs/${id}`);
}

export function getEvents() {
  return apiFetch<EventWithOrganization[]>('/api/mobile/events');
}

export function getEvent(id: string) {
  return apiFetch<EventDetailResponse>(`/api/mobile/events/${id}`);
}

export function getFighters() {
  return apiFetch<FighterWithOrganization[]>('/api/mobile/fighters');
}

export function getFighter(id: string) {
  return apiFetch<FighterDetailResponse>(`/api/mobile/fighters/${id}`);
}
```

- [ ] **Step 5: Write the shared data-fetching hook**

```ts
// mobile/lib/use-api.ts
import { useCallback, useEffect, useState } from 'react';

type ApiState<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: T };

export function useApi<T>(fetcher: () => Promise<T>, deps: unknown[]): [ApiState<T>, () => void] {
  const [state, setState] = useState<ApiState<T>>({ status: 'loading' });
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    fetcher()
      .then((data) => {
        if (!cancelled) setState({ status: 'success', data });
      })
      .catch((error: Error) => {
        if (!cancelled) setState({ status: 'error', message: error.message });
      });
    return () => {
      cancelled = true;
    };
    // fetcher is expected to be a fresh closure per render when deps change — deps drives refetch, not fetcher identity
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadToken]);

  return [state, reload];
}
```

- [ ] **Step 6: Commit**

```bash
git add lib/api.ts lib/use-api.ts .env.example .gitignore
git commit -m "feat(mobile): add API client and data-fetching hook"
```

(`.env` itself is not committed — verify with `git status` that it doesn't appear.)

---

## Task 12: Shared state components

**Files:**
- Create: `mobile/components/state.tsx`

- [ ] **Step 1: Write the components**

```tsx
// mobile/components/state.tsx
import { View, Text, ActivityIndicator, Pressable } from 'react-native';

export function Loading() {
  return (
    <View className="flex-1 items-center justify-center bg-base-bg">
      <ActivityIndicator color="#ff3b30" />
    </View>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <View className="flex-1 items-center justify-center bg-base-bg p-6">
      <Text className="text-center text-ink-secondary">{message}</Text>
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-base-bg p-6">
      <Text className="text-center text-ink-secondary">{message}</Text>
      <Pressable onPress={onRetry} className="rounded-md bg-accent px-4 py-2">
        <Text className="font-bold text-white">Réessayer</Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/state.tsx
git commit -m "feat(mobile): add shared loading/empty/error state components"
```

---

## Task 13: Card components

**Files:**
- Create: `mobile/components/cards.tsx`

- [ ] **Step 1: Write the components**

```tsx
// mobile/components/cards.tsx
import { View, Text, Image, Pressable } from 'react-native';
import type { EventWithOrganization, FighterWithOrganization, FightWithFighters, Organization } from '../lib/types';

export function OrganizationCard({ organization, onPress }: { organization: Organization; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center gap-3 rounded-lg border border-base-border bg-base-card p-3">
      <Image source={{ uri: organization.logo_link }} className="h-12 w-12 rounded-full" />
      <View>
        <Text className="font-display text-xs uppercase tracking-wide text-accent">{organization.abbreviation}</Text>
        <Text className="text-base font-semibold text-ink-primary">{organization.name}</Text>
      </View>
    </Pressable>
  );
}

export function EventCard({ event, onPress }: { event: EventWithOrganization; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="rounded-lg border border-base-border bg-base-card p-3">
      <Text className="font-display text-xs uppercase tracking-wide text-accent">{event.organization_abbreviation}</Text>
      <Text className="text-base font-semibold text-ink-primary">{event.name}</Text>
      <Text className="text-xs text-ink-secondary">
        {event.date} · {event.event_location}
      </Text>
    </Pressable>
  );
}

export function FighterCard({ fighter, onPress }: { fighter: FighterWithOrganization; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center gap-3 rounded-lg border border-base-border bg-base-card p-3">
      <Image source={{ uri: fighter.image_url }} className="h-12 w-12 rounded-full" />
      <View className="flex-1">
        <Text className="text-base font-semibold text-ink-primary">{fighter.name}</Text>
        <Text className="text-xs text-ink-secondary">
          {fighter.organization_abbreviation} · {fighter.weight_class} · {fighter.record}
        </Text>
      </View>
    </Pressable>
  );
}

export function FightRow({ fight }: { fight: FightWithFighters }) {
  const winnerName =
    fight.winner_id === fight.fighter1?.id
      ? fight.fighter1?.name
      : fight.winner_id === fight.fighter2?.id
        ? fight.fighter2?.name
        : null;

  return (
    <View className="rounded-lg border border-base-border bg-base-card p-3">
      <Text className="text-xs uppercase tracking-wide text-ink-secondary">{fight.weight_class}</Text>
      <View className="flex-row items-center justify-between py-1">
        <Text
          className={`flex-1 text-base font-semibold ${fight.winner_id === fight.fighter1?.id ? 'text-accent' : 'text-ink-primary'}`}
        >
          {fight.fighter1?.name ?? 'TBD'}
        </Text>
        <Text className="px-2 text-ink-secondary">vs</Text>
        <Text
          className={`flex-1 text-right text-base font-semibold ${fight.winner_id === fight.fighter2?.id ? 'text-accent' : 'text-ink-primary'}`}
        >
          {fight.fighter2?.name ?? 'TBD'}
        </Text>
      </View>
      {fight.fight_finished ? (
        <Text className="text-xs text-ink-secondary">
          {winnerName ? `${winnerName} par ${fight.method}` : 'Match nul'} · Round {fight.round} · {fight.time}
        </Text>
      ) : (
        <Text className="text-xs text-ink-secondary">À venir</Text>
      )}
    </View>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/cards.tsx
git commit -m "feat(mobile): add organization/event/fighter cards and fight row"
```

---

## Task 14: Bottom tab navigation shell

**Files:**
- Create: `mobile/app/(tabs)/_layout.tsx`
- Create: `mobile/app/(tabs)/index.tsx` (placeholder, replaced in Task 15)
- Create: `mobile/app/(tabs)/orgs/index.tsx`, `mobile/app/(tabs)/orgs/[id].tsx` (placeholders, replaced in Task 16)
- Create: `mobile/app/(tabs)/events/index.tsx`, `mobile/app/(tabs)/events/[id].tsx` (placeholders, replaced in Task 17)
- Create: `mobile/app/(tabs)/fighters/index.tsx`, `mobile/app/(tabs)/fighters/[id].tsx` (placeholders, replaced in Task 18)
- Delete: `mobile/app/index.tsx`
- Modify: `mobile/app/_layout.tsx`

- [ ] **Step 1: Move the root screen into the tabs group**

```bash
rm app/index.tsx
```

- [ ] **Step 2: Write the tab navigator**

```tsx
// mobile/app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { Text } from 'react-native';

function TabIcon({ children }: { children: string }) {
  return <Text style={{ fontSize: 18 }}>{children}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#0a0a0a' },
        headerTintColor: '#f5f5f5',
        tabBarStyle: { backgroundColor: '#161616', borderTopColor: '#262626' },
        tabBarActiveTintColor: '#ff3b30',
        tabBarInactiveTintColor: '#9a9a9a',
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: () => <TabIcon>🏠</TabIcon> }} />
      <Tabs.Screen name="events/index" options={{ title: 'Events', tabBarIcon: () => <TabIcon>📅</TabIcon> }} />
      <Tabs.Screen name="events/[id]" options={{ href: null, title: 'Event' }} />
      <Tabs.Screen name="fighters/index" options={{ title: 'Fighters', tabBarIcon: () => <TabIcon>🥊</TabIcon> }} />
      <Tabs.Screen name="fighters/[id]" options={{ href: null, title: 'Fighter' }} />
      <Tabs.Screen name="orgs/index" options={{ title: 'Orgs', tabBarIcon: () => <TabIcon>🏷️</TabIcon> }} />
      <Tabs.Screen name="orgs/[id]" options={{ href: null, title: 'Organization' }} />
    </Tabs>
  );
}
```

- [ ] **Step 3: Create placeholder screens for every tab and detail route**

```tsx
// mobile/app/(tabs)/index.tsx
import { View, Text } from 'react-native';

export default function HomeScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-base-bg">
      <Text className="text-ink-primary">Home</Text>
    </View>
  );
}
```

```tsx
// mobile/app/(tabs)/orgs/index.tsx
import { View, Text } from 'react-native';

export default function OrgsScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-base-bg">
      <Text className="text-ink-primary">Orgs</Text>
    </View>
  );
}
```

```tsx
// mobile/app/(tabs)/orgs/[id].tsx
import { View, Text } from 'react-native';

export default function OrgDetailScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-base-bg">
      <Text className="text-ink-primary">Org detail</Text>
    </View>
  );
}
```

```tsx
// mobile/app/(tabs)/events/index.tsx
import { View, Text } from 'react-native';

export default function EventsScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-base-bg">
      <Text className="text-ink-primary">Events</Text>
    </View>
  );
}
```

```tsx
// mobile/app/(tabs)/events/[id].tsx
import { View, Text } from 'react-native';

export default function EventDetailScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-base-bg">
      <Text className="text-ink-primary">Event detail</Text>
    </View>
  );
}
```

```tsx
// mobile/app/(tabs)/fighters/index.tsx
import { View, Text } from 'react-native';

export default function FightersScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-base-bg">
      <Text className="text-ink-primary">Fighters</Text>
    </View>
  );
}
```

```tsx
// mobile/app/(tabs)/fighters/[id].tsx
import { View, Text } from 'react-native';

export default function FighterDetailScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-base-bg">
      <Text className="text-ink-primary">Fighter detail</Text>
    </View>
  );
}
```

- [ ] **Step 4: Point the root layout's stack at the tabs group**

```tsx
// mobile/app/_layout.tsx
import '../global.css';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { useFonts, Oswald_400Regular, Oswald_700Bold } from '@expo-google-fonts/oswald';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Oswald_400Regular, Oswald_700Bold });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
```

- [ ] **Step 5: Verify manually**

Run: `npx expo start -c`
Expected: 4 tabs visible (Home/Events/Fighters/Orgs) with the Dark Combat colors, each showing its placeholder text. Tapping between them works; no extra "[id]" tabs appear in the tab bar.

- [ ] **Step 6: Commit**

```bash
git add app
git commit -m "feat(mobile): add bottom tab navigation shell with placeholder screens"
```

---

## Task 15: Home screen

**Files:**
- Modify: `mobile/app/(tabs)/index.tsx`

- [ ] **Step 1: Replace the placeholder with the real screen**

```tsx
// mobile/app/(tabs)/index.tsx
import { View, Text, ScrollView, Image, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { getHome } from '../../lib/api';
import { useApi } from '../../lib/use-api';
import { Loading, ErrorState, EmptyState } from '../../components/state';
import { OrganizationCard } from '../../components/cards';

export default function HomeScreen() {
  const router = useRouter();
  const [state, reload] = useApi(getHome, []);

  if (state.status === 'loading') return <Loading />;
  if (state.status === 'error') return <ErrorState message={state.message} onRetry={reload} />;

  const { nextEvent, organizations } = state.data;

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

- [ ] **Step 2: Verify manually**

Run: `npx expo start -c` (make sure `npm run dev` is still running on the Next.js side so `/api/mobile/home` responds)
Expected: Home tab shows a real next-event hero and the 3 organizations; tapping the hero navigates to that event's detail placeholder; tapping an organization navigates to its detail placeholder.

- [ ] **Step 3: Commit**

```bash
git add app/\(tabs\)/index.tsx
git commit -m "feat(mobile): build the Home screen"
```

---

## Task 16: Orgs screens

**Files:**
- Modify: `mobile/app/(tabs)/orgs/index.tsx`
- Modify: `mobile/app/(tabs)/orgs/[id].tsx`

- [ ] **Step 1: Replace the list placeholder**

```tsx
// mobile/app/(tabs)/orgs/index.tsx
import { View, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { getOrgs } from '../../../lib/api';
import { useApi } from '../../../lib/use-api';
import { Loading, ErrorState, EmptyState } from '../../../components/state';
import { OrganizationCard } from '../../../components/cards';

export default function OrgsScreen() {
  const router = useRouter();
  const [state, reload] = useApi(getOrgs, []);

  if (state.status === 'loading') return <Loading />;
  if (state.status === 'error') return <ErrorState message={state.message} onRetry={reload} />;
  if (state.data.length === 0) return <EmptyState message="Aucune organisation." />;

  return (
    <FlatList
      className="flex-1 bg-base-bg"
      contentContainerStyle={{ padding: 16, gap: 12 }}
      data={state.data}
      keyExtractor={(org) => String(org.id)}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      renderItem={({ item }) => <OrganizationCard organization={item} onPress={() => router.push(`/orgs/${item.id}`)} />}
    />
  );
}
```

- [ ] **Step 2: Replace the detail placeholder**

```tsx
// mobile/app/(tabs)/orgs/[id].tsx
import { View, Text, FlatList } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getOrg } from '../../../lib/api';
import { useApi } from '../../../lib/use-api';
import { Loading, ErrorState, EmptyState } from '../../../components/state';
import { EventCard } from '../../../components/cards';

export default function OrgDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [state, reload] = useApi(() => getOrg(id), [id]);

  if (state.status === 'loading') return <Loading />;
  if (state.status === 'error') return <ErrorState message={state.message} onRetry={reload} />;

  const { organization, events } = state.data;

  return (
    <FlatList
      className="flex-1 bg-base-bg"
      contentContainerStyle={{ padding: 16, gap: 12 }}
      data={events}
      keyExtractor={(event) => String(event.id)}
      ListHeaderComponent={
        <View className="mb-4">
          <Text className="font-display text-xs uppercase tracking-wide text-accent">{organization.abbreviation}</Text>
          <Text className="font-display text-2xl uppercase text-ink-primary">{organization.name}</Text>
        </View>
      }
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      ListEmptyComponent={<EmptyState message="Aucun événement programmé pour cette organisation." />}
      renderItem={({ item }) => (
        <EventCard
          event={{ ...item, organization_abbreviation: organization.abbreviation }}
          onPress={() => router.push(`/events/${item.id}`)}
        />
      )}
    />
  );
}
```

- [ ] **Step 3: Verify manually**

Run: `npx expo start -c`
Expected: Orgs tab lists UFC/PFL/Bellator; tapping one shows its real events list (or the empty state if that org has none locally).

- [ ] **Step 4: Commit**

```bash
git add app/\(tabs\)/orgs
git commit -m "feat(mobile): build the Orgs list and detail screens"
```

---

## Task 17: Events screens

**Files:**
- Modify: `mobile/app/(tabs)/events/index.tsx`
- Modify: `mobile/app/(tabs)/events/[id].tsx`

- [ ] **Step 1: Replace the list placeholder, with an org filter**

```tsx
// mobile/app/(tabs)/events/index.tsx
import { useState } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { getEvents } from '../../../lib/api';
import { useApi } from '../../../lib/use-api';
import { Loading, ErrorState, EmptyState } from '../../../components/state';
import { EventCard } from '../../../components/cards';

export default function EventsScreen() {
  const router = useRouter();
  const [state, reload] = useApi(getEvents, []);
  const [orgFilter, setOrgFilter] = useState<string | null>(null);

  if (state.status === 'loading') return <Loading />;
  if (state.status === 'error') return <ErrorState message={state.message} onRetry={reload} />;

  const orgs = Array.from(new Set(state.data.map((event) => event.organization_abbreviation)));
  const filtered = orgFilter ? state.data.filter((event) => event.organization_abbreviation === orgFilter) : state.data;

  return (
    <View className="flex-1 bg-base-bg">
      <View className="flex-row gap-2 p-4">
        <Pressable
          onPress={() => setOrgFilter(null)}
          className={`rounded-full border px-3 py-1 ${orgFilter === null ? 'border-accent bg-accent' : 'border-base-border bg-base-card'}`}
        >
          <Text className={orgFilter === null ? 'text-white' : 'text-ink-secondary'}>Tous</Text>
        </Pressable>
        {orgs.map((abbreviation) => (
          <Pressable
            key={abbreviation}
            onPress={() => setOrgFilter(abbreviation)}
            className={`rounded-full border px-3 py-1 ${orgFilter === abbreviation ? 'border-accent bg-accent' : 'border-base-border bg-base-card'}`}
          >
            <Text className={orgFilter === abbreviation ? 'text-white' : 'text-ink-secondary'}>{abbreviation}</Text>
          </Pressable>
        ))}
      </View>
      <FlatList
        contentContainerStyle={{ padding: 16, paddingTop: 0, gap: 12 }}
        data={filtered}
        keyExtractor={(event) => String(event.id)}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={<EmptyState message="Aucun événement pour ce filtre." />}
        renderItem={({ item }) => <EventCard event={item} onPress={() => router.push(`/events/${item.id}`)} />}
      />
    </View>
  );
}
```

- [ ] **Step 2: Replace the detail placeholder**

```tsx
// mobile/app/(tabs)/events/[id].tsx
import { View, Text, FlatList } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { getEvent } from '../../../lib/api';
import { useApi } from '../../../lib/use-api';
import { Loading, ErrorState, EmptyState } from '../../../components/state';
import { FightRow } from '../../../components/cards';

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [state, reload] = useApi(() => getEvent(id), [id]);

  if (state.status === 'loading') return <Loading />;
  if (state.status === 'error') return <ErrorState message={state.message} onRetry={reload} />;

  const { event, fights } = state.data;

  return (
    <FlatList
      className="flex-1 bg-base-bg"
      contentContainerStyle={{ padding: 16, gap: 12 }}
      data={fights}
      keyExtractor={(fight) => String(fight.id)}
      ListHeaderComponent={
        <View className="mb-4">
          <Text className="font-display text-2xl uppercase text-ink-primary">{event.name}</Text>
          <Text className="text-sm text-ink-secondary">
            {event.date} · {event.event_location}
          </Text>
        </View>
      }
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      ListEmptyComponent={<EmptyState message="Aucun combat annoncé pour cet event." />}
      renderItem={({ item }) => <FightRow fight={item} />}
    />
  );
}
```

- [ ] **Step 3: Verify manually**

Run: `npx expo start -c`
Expected: Events tab lists all events across the 3 orgs, sorted by date; the org filter pills narrow the list; tapping an event shows its real fight card with winners highlighted in accent red.

- [ ] **Step 4: Commit**

```bash
git add app/\(tabs\)/events
git commit -m "feat(mobile): build the Events list and detail screens"
```

---

## Task 18: Fighters screens

**Files:**
- Modify: `mobile/app/(tabs)/fighters/index.tsx`
- Modify: `mobile/app/(tabs)/fighters/[id].tsx`

- [ ] **Step 1: Replace the list placeholder, with an org filter**

```tsx
// mobile/app/(tabs)/fighters/index.tsx
import { useState } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { getFighters } from '../../../lib/api';
import { useApi } from '../../../lib/use-api';
import { Loading, ErrorState, EmptyState } from '../../../components/state';
import { FighterCard } from '../../../components/cards';

export default function FightersScreen() {
  const router = useRouter();
  const [state, reload] = useApi(getFighters, []);
  const [orgFilter, setOrgFilter] = useState<string | null>(null);

  if (state.status === 'loading') return <Loading />;
  if (state.status === 'error') return <ErrorState message={state.message} onRetry={reload} />;

  const orgs = Array.from(new Set(state.data.map((fighter) => fighter.organization_abbreviation)));
  const filtered = orgFilter ? state.data.filter((fighter) => fighter.organization_abbreviation === orgFilter) : state.data;

  return (
    <View className="flex-1 bg-base-bg">
      <View className="flex-row gap-2 p-4">
        <Pressable
          onPress={() => setOrgFilter(null)}
          className={`rounded-full border px-3 py-1 ${orgFilter === null ? 'border-accent bg-accent' : 'border-base-border bg-base-card'}`}
        >
          <Text className={orgFilter === null ? 'text-white' : 'text-ink-secondary'}>Tous</Text>
        </Pressable>
        {orgs.map((abbreviation) => (
          <Pressable
            key={abbreviation}
            onPress={() => setOrgFilter(abbreviation)}
            className={`rounded-full border px-3 py-1 ${orgFilter === abbreviation ? 'border-accent bg-accent' : 'border-base-border bg-base-card'}`}
          >
            <Text className={orgFilter === abbreviation ? 'text-white' : 'text-ink-secondary'}>{abbreviation}</Text>
          </Pressable>
        ))}
      </View>
      <FlatList
        contentContainerStyle={{ padding: 16, paddingTop: 0, gap: 12 }}
        data={filtered}
        keyExtractor={(fighter) => String(fighter.id)}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={<EmptyState message="Aucun combattant pour ce filtre." />}
        renderItem={({ item }) => <FighterCard fighter={item} onPress={() => router.push(`/fighters/${item.id}`)} />}
      />
    </View>
  );
}
```

- [ ] **Step 2: Replace the detail placeholder with stats and fight history**

```tsx
// mobile/app/(tabs)/fighters/[id].tsx
import { View, Text, Image, FlatList } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { getFighter } from '../../../lib/api';
import { useApi } from '../../../lib/use-api';
import { Loading, ErrorState, EmptyState } from '../../../components/state';

const RESULT_LABEL: Record<string, string> = { win: 'V', loss: 'D', draw: 'N', upcoming: 'À venir' };
const RESULT_COLOR: Record<string, string> = {
  win: 'text-accent',
  loss: 'text-ink-secondary',
  draw: 'text-ink-secondary',
  upcoming: 'text-ink-secondary',
};

export default function FighterDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [state, reload] = useApi(() => getFighter(id), [id]);

  if (state.status === 'loading') return <Loading />;
  if (state.status === 'error') return <ErrorState message={state.message} onRetry={reload} />;

  const { fighter, fights, stats } = state.data;

  return (
    <FlatList
      className="flex-1 bg-base-bg"
      contentContainerStyle={{ padding: 16, gap: 12 }}
      data={fights}
      keyExtractor={(fight) => String(fight.id)}
      ListHeaderComponent={
        <View className="mb-4 gap-4">
          <View className="flex-row items-center gap-4">
            <Image source={{ uri: fighter.image_url }} className="h-20 w-20 rounded-full" />
            <View>
              <Text className="font-display text-xs uppercase tracking-wide text-accent">
                {fighter.organization_abbreviation} · {fighter.weight_class}
              </Text>
              <Text className="font-display text-2xl uppercase text-ink-primary">{fighter.name}</Text>
              <Text className="text-sm text-ink-secondary">{fighter.record}</Text>
            </View>
          </View>
          <View className="flex-row justify-between rounded-lg border border-base-border bg-base-card p-3">
            <Text className="text-ink-secondary">V {stats.wins}</Text>
            <Text className="text-ink-secondary">D {stats.losses}</Text>
            <Text className="text-ink-secondary">N {stats.draws}</Text>
            <Text className="text-ink-secondary">KO {stats.ko}</Text>
            <Text className="text-ink-secondary">Sub {stats.submission}</Text>
            <Text className="text-ink-secondary">Déc {stats.decision}</Text>
          </View>
          <Text className="font-display text-lg uppercase text-ink-primary">Historique</Text>
        </View>
      }
      ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      ListEmptyComponent={<EmptyState message="Aucun combat enregistré." />}
      renderItem={({ item }) => (
        <View className="flex-row items-center justify-between rounded-lg border border-base-border bg-base-card p-3">
          <View>
            <Text className="text-base font-semibold text-ink-primary">vs {item.opponent_name ?? 'Adversaire inconnu'}</Text>
            <Text className="text-xs text-ink-secondary">
              {item.event_name} · {item.event_date}
            </Text>
          </View>
          <Text className={`font-display text-lg ${RESULT_COLOR[item.result]}`}>{RESULT_LABEL[item.result]}</Text>
        </View>
      )}
    />
  );
}
```

- [ ] **Step 3: Verify manually**

Run: `npx expo start -c`
Expected: Fighters tab lists combattants with org filter; tapping one shows photo, record, a stats row (V/D/N/KO/Sub/Déc), and a fight history list with correct win/loss/draw markers (no false draws — same guarantee as the web site since chantier 2).

- [ ] **Step 4: Commit**

```bash
git add app/\(tabs\)/fighters
git commit -m "feat(mobile): build the Fighters list and detail screens"
```

---

## Task 19: End-to-end manual verification

- [ ] **Step 1: Start both servers**

Terminal 1 (repo root): `npm run dev`
Terminal 2 (`mobile/`): `npx expo start`

- [ ] **Step 2: Open in Expo Go on a physical device (or a simulator/emulator)**

Scan the QR code. Confirm `mobile/.env`'s `EXPO_PUBLIC_API_URL` uses your machine's LAN IP (not `localhost`) if testing on a physical device.

- [ ] **Step 3: Walk the full flow**

1. Home → real next event hero, 3 organizations listed.
2. Tap an organization → its real events, in the org's colors.
3. Tap an event → real fight card, winners in accent red, losers/upcoming in the default color.
4. Events tab → all 3 orgs mixed, sorted by date; org filter pills work.
5. Fighters tab → org filter works; tap a fighter → stats + history with correct win/loss/draw (cross-check one fighter against the same fighter's page on the web site — counts should match).
6. Turn off Wi-Fi on the device mid-navigation, pull to a new screen → error state with "Réessayer" appears instead of a crash; turn Wi-Fi back on, tap "Réessayer" → content loads.

- [ ] **Step 4: Report results**

Note in the PR/commit description which of the 6 checks passed, and attach a couple of screenshots (Home, Fighter detail) if the reviewer doesn't have a device handy.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(mobile): chantier 4 v1 complete — manual e2e verified" --allow-empty
```

---

## Self-Review Notes

- **Spec coverage:** every section of `docs/superpowers/specs/2026-08-18-mobile-app-design.md` maps to a task — project structure (7–9, 14), API layer (1–6), navigation & screens (14–18), styling (8–9, 13), error/loading states (12, used throughout 15–18), manual verification (6, 19).
- **Hors périmètre respected:** no auth, no push, no offline cache, no EAS build, no monorepo tooling, no React Query/SWR — all left out as specced.
- **Type consistency checked:** `HomeResponse`/`OrgDetailResponse`/`EventDetailResponse`/`FighterDetailResponse` in `mobile/lib/types.ts` (Task 10) match exactly what each route handler returns (Tasks 2–5) and what each screen destructures (Tasks 15–18). `useApi`'s generic `ApiState<T>` is used identically across all 5 screens.
