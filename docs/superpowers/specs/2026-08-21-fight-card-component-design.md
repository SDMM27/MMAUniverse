# FightCard component — design

**Date:** 2026-08-21
**Status:** Approved, ready for implementation planning

## 1. Goal

Add a `FightCard` component — a prominent, poster-style presentation of a single
fight (à la a match card in a sports app) — for **featured spots only**:

- The home page's "Combats à venir" section, for the main event of the next
  upcoming event.
- The event detail page, for that event's main event.

Everywhere else, the existing `FightRow` keeps handling fight listings
unchanged. `FightCard` is additive, not a replacement.

Built for both platforms:

- **Web:** `components/ui/fights/fight-card.tsx` (Next.js / Tailwind)
- **Mobile:** `mobile/components/cards.tsx` (Expo / React Native / NativeWind)

## 2. States

`FightCard` renders one of three states, derived from data rather than passed
explicitly:

| State | Trigger | Notes |
|---|---|---|
| `upcoming` | `fight.fight_finished === false` and no `live` prop | Default state for scheduled fights |
| `live` | `fight.fight_finished === false` and a `live` prop is passed | **No real data source exists yet.** No page in this project passes `live` today — it's implemented and manually verified with mock props, ready for a future real-time feed. |
| `finished` | `fight.fight_finished === true` | Uses `winner_id`, `method`, `round` — no per-round score exists in the data model |

## 3. Data model changes

Two new nullable/defaulted columns, added via `ALTER TABLE ... ADD COLUMN IF
NOT EXISTS` in [`app/seed/route.ts`](../../../app/seed/route.ts) (this project
has no migration framework — schema changes live in the seed route alongside
the existing `CREATE TABLE IF NOT EXISTS` statements):

```sql
ALTER TABLE fighters ADD COLUMN IF NOT EXISTS nationality VARCHAR(2); -- ISO 3166-1 alpha-2, e.g. 'FR'
ALTER TABLE fights ADD COLUMN IF NOT EXISTS is_main_event BOOLEAN NOT NULL DEFAULT false;
```

- `nationality` stores an ISO alpha-2 code, not the flag emoji. A small
  `countryCodeToFlag(code): string` util converts code → flag emoji at render
  time, duplicated into `data/lib` and `mobile/lib` respectively — matching
  how the rest of the data layer is already duplicated between the two
  (e.g. `definitions.ts` / `types.ts`), rather than introducing a first
  shared module between the apps. `null` → no flag rendered.
- `is_main_event` defaults to `false` for all existing rows. Both columns are
  backfilled **by hand** for fighters/events actually in rotation — same
  placeholder-data pattern already used for org/event seeding. No scraper
  changes.
- Type updates needed in both `data/lib/definitions.ts` and
  `mobile/lib/types.ts`: `Fighter.nationality: string | null`,
  `Fight.is_main_event: boolean`.
- Query updates: `fetchFightsByEvent` (web) and its mobile equivalent need to
  `SELECT` and map both new columns through to `FightWithFighters`.

## 4. Component API

```ts
type FightCardProps = {
  fight: FightWithFighters & { is_main_event: boolean };
  event: { id: number; date: string; organization_abbreviation: string };
  live?: { round: number }; // presence triggers the live state
};
```

- **Web:** self-wraps in `next/link` to `/events/${event.id}`, matching
  `EventCard`'s pattern.
- **Mobile:** takes an `onPress` prop instead, matching `EventCard` /
  `FighterCard` in `mobile/components/cards.tsx` — the screen wires it to
  `expo-router` navigation.
- Fighter thumbnails follow each platform's existing convention rather than a
  new shared style: rounded-square on web (like `FightRow`'s `CoverImage`),
  circular on mobile (like `FighterCard`).
- No dedicated component tests — this repo has no component test
  infrastructure (only `data/**/*.test.ts` via Node's test runner), and
  sibling components (`FightRow`, `EventCard`, `FighterCard`) have none
  either. The `live` state is verified manually during implementation.

## 5. Visual spec (Direction A — "Poster")

Vertical card, dark theme, existing design tokens
(`tailwind.config.ts`: `base.card #161616`, `base.border #262626`,
`accent #ff3b30`, `win #3fb950`, `ink.primary #f5f5f5`, `ink.secondary
#9a9a9a`, `font-display` = Oswald).

**Header row** (top of card, varies by state):

- `upcoming`: org abbreviation (left, accent, uppercase) · event date (right, secondary)
- `live`: "● LIVE" badge (left, accent-filled pill, pulsing dot) · "Round N" (right)
- `finished`: org abbreviation (left) · "Finished" badge (right, outlined)

**Center matchup:**

- Two fighter columns: thumbnail, flag emoji (if `nationality` present),
  name (uppercase, bold), rank (`#N`, accent, from `fighter.ranking` — no
  weight-class abbreviation, since no abbreviation mapping exists for the
  full-text `weight_class` values in the data).
- Between them:
  - `upcoming`: "VS" (secondary, small)
  - `live`: a single pulsing accent dot (no score — no live scoring data exists)
  - `finished`: `W` / `L` badge under each fighter's name (`W` in `win`
    green, `L` in secondary gray) computed from `winner_id`; center meta
    line shows `method · Round N`

**Footer:**

- "Main Event" pill (accent, uppercase, small, top border divider) — always
  shown, since `FightCard` is only ever used for fights where
  `is_main_event === true`.

## 6. Page integration

Same rule on every surface that renders a fight list for one event: if one
fight in the list has `is_main_event === true`, render it as `FightCard`
above the rest, which render as `FightRow` as they do today.

- **Home page** ([`app/page.tsx`](../../../app/page.tsx)): applies within the
  existing "Combats à venir" section (`heroFights`). `NextEventHero` is
  unchanged.
- **Event detail page**
  ([`app/events/[slug]/page.tsx`](../../../app/events/[slug]/page.tsx)):
  applies to `fights` for that event.
- **Mobile event screen** `mobile/app/(tabs)/events/[id].tsx`: same rule, ported.
- **Mobile home screen** `mobile/app/(tabs)/index.tsx`: has no fight list
  today (only the next-event hero poster + org list), unlike the web home
  page. `HomeResponse` (`mobile/lib/types.ts`) gains a `fights:
  FightWithFighters[]` field — the next upcoming event's fights, fetched by
  `/api/mobile/home` the same way the web home page fetches `heroFights` (via
  `fetchFightsByEvent`, only when `computeNextEvent` returns `isUpcoming:
  true`; otherwise `[]`). The screen renders the main-event fight as a
  `FightCard` below the hero poster when present. No full "derniers
  résultats" section is added — that stays a web-only home feature for now.
- **Fallback:** if no fight in the list is flagged `is_main_event` (not yet
  hand-set for that event), the section renders exactly as today — all
  `FightRow`, no `FightCard`, no placeholder/error state.

## 7. Explicitly out of scope

- Real live-results data (round tracking, live scoring, a live-data
  pipeline/source). `live` is UI-only until a future project adds this.
- Scraper changes to source fighter nationality automatically.
- Replacing `FightRow` anywhere — it keeps handling all non-featured fight
  listings.
- A weight-class abbreviation system (e.g. "HW" for Heavyweight) — rank
  displays as `#N` only.
