# Fighter win/loss method breakdown — design

**Date:** 2026-08-28
**Status:** Approved, ready for implementation planning

## 1. Goal

Replace the current, minimal win/loss stats display on the fighter detail
page with a Sherdog-style breakdown: for **both** wins and losses, show the
total and a KO/TKO · Submissions · Decisions split with counts and
percentages, mirroring
[the Sherdog fighter card](https://www.sherdog.com) two-column layout
(`WINS` / `LOSSES`, one column each, each with three method rows and a
progress bar).

Built for both platforms:

- **Web:** `components/ui/fighters/fighter-record-card.tsx`, used in
  [`app/fighters/[slug]/page.tsx`](../../../app/fighters/%5Bslug%5D/page.tsx)
- **Mobile:** `mobile/components/fighter-record-card.tsx`, used in
  `mobile/app/(tabs)/fighters/[id].tsx`

This fully **replaces** the existing display on both platforms — the current
3-box `Wins`/`Losses`/`KO` grid on web, and the single V/D/N/KO/Sub/Déc row
on mobile — rather than being added alongside it.

## 2. Explicitly out of scope

This spec covers only the win/loss method breakdown, using data the app
already has (fight history with `method` per fight). It does **not** cover
adding age, height, weight, or association/club to the fighter profile —
those fields don't exist in the data model or the Sherdog scraper today
(`data/scrapers/parse.ts`'s `parseFighterDetails` only extracts name, image,
weight class, and W-L-D record) and would require scraper changes, a DB
migration, and a backfill. That's a separate project with its own spec.

## 3. Data model changes

`FighterStats` (in both
[`data/lib/definitions.ts`](../../../data/lib/definitions.ts) and its mobile
mirror `mobile/lib/types.ts`) changes from a wins-only method breakdown to a
symmetric one for both outcomes:

```ts
// Before
type FighterStats = {
  wins: number;
  losses: number;
  draws: number;
  ko: number;
  submission: number;
  decision: number;
};

// After
type MethodBreakdown = { koTko: number; submission: number; decision: number };

type FighterStats = {
  wins: number;
  losses: number;
  draws: number;
  winMethods: MethodBreakdown;
  lossMethods: MethodBreakdown;
};
```

This is a breaking shape change consumed in five files: the two type
definitions above, `data/lib/fighter-stats.ts` (produces it),
`app/api/mobile/fighters/[slug]/route.ts` (passes it through unchanged, no
code change needed beyond the type following along), and the two page/screen
consumers listed in §1.

## 4. Computation — reuse the existing method-category util

[`data/lib/fighter-stats.ts`](../../../data/lib/fighter-stats.ts) currently
has its own private `categorizeMethod()` using loose `.includes()` matching,
duplicating
[`normalizeMethodCategory`](../../../data/lib/method-category.ts) — an
existing, tested utility (`data/lib/method-category.test.ts`) already used by
the pick'em scoring logic, with more precise `startsWith()` matching and
coverage for the "Submision" scraper typo. `categorizeMethod` is deleted;
`computeFighterStats` calls `normalizeMethodCategory(fight.method ?? '')` for
both win and loss results and tallies into `winMethods` / `lossMethods`
respectively:

```ts
function tally(target: MethodBreakdown, category: MethodCategory | 'other') {
  if (category === 'ko_tko') target.koTko += 1;
  else if (category === 'submission') target.submission += 1;
  else if (category === 'decision') target.decision += 1;
  // 'other' (DQ, no contest reclassified, etc.) is counted in wins/losses
  // but not in any method bucket — same behavior as today for wins, now
  // extended to losses. Bucket sum can be < wins/losses when this happens.
}
```

Percentages are **not stored** on `FighterStats` — each UI component computes
`Math.round((count / total) * 100)` at render time, where `total` is `wins`
or `losses` for that column, guarding `total === 0` to render `0%` (avoids
`NaN` from a fighter with no wins or no losses yet).

## 5. Component: web `FighterRecordCard`

New file `components/ui/fighters/fighter-record-card.tsx`, default export
`FighterRecordCard`, props `{ stats: FighterStats }`. Replaces the
`StatBox` grid at
[`app/fighters/[slug]/page.tsx:33`](../../../app/fighters/%5Bslug%5D/page.tsx)
(the local `StatBox` helper is removed).

Layout, using existing tokens (`tailwind.config.ts`: `base.card #161616`,
`base.border #262626`, `accent #ff3b30`, `win #3fb950`, `ink.primary
#f5f5f5`, `ink.secondary #9a9a9a`, `font-display` = Oswald):

- Outer card: `rounded-lg border border-base-border bg-base-card p-4`.
- If `stats.draws > 0`: a small `text-xs text-ink-secondary` line above the
  columns, e.g. `${wins}-${losses} · ${draws} nul${draws > 1 ? 's' : ''}`.
  Omitted entirely when `draws === 0` (no "0 nuls" clutter).
- Two-column flex row, divided by a 1px `border-base-border` vertical rule:
  - **Wins column:** `VICTOIRES` badge (`bg-win text-base-bg`, small,
    uppercase, bold), total count large next to/below it, then three method
    rows (KO/TKO, Soumissions, Décisions) each rendering: label
    (uppercase, `text-ink-secondary`), `count · pct%` (`text-ink-primary`,
    bold), and a progress bar (`bg-base-border` track, `bg-win` fill).
  - **Losses column:** identical structure, `DÉFAITES` badge (`bg-accent
    text-ink-primary`) and `bg-accent` fill — validated with the user via
    mockup as the preferred color (over a gray/neutral loss column), even
    though `fight-row.tsx` elsewhere on web uses gray for losses; the
    mobile `FightCard` in `mobile/components/cards.tsx` already uses accent
    red for losses, so this isn't a new inconsistency introduced by this
    work.
- **Bar widths are dynamic per fighter and must use inline
  `style={{ width: '${pct}%' }}`, not a Tailwind width class** — Tailwind
  only picks up class names it can find statically in source, so a
  data-driven `w-[${pct}%]` string silently fails to generate CSS.

## 6. Component: mobile `FighterRecordCard`

New file `mobile/components/fighter-record-card.tsx` (kept separate from
`mobile/components/cards.tsx`, which holds only `Pressable`/navigable
cards — this is a static info block), default export `FighterRecordCard`,
same props shape. Replaces the stats `View` at
`mobile/app/(tabs)/fighters/[id].tsx:43`.

Same visual structure as web, built with `View`/`Text` and NativeWind
class names from `mobile/tailwind.config.js` (identical token values to
web). Same dynamic-width caveat applies: bar fill width is set via the
`style` prop, not a NativeWind class.

## 7. Testing

New `data/lib/fighter-stats.test.ts` (none exists today), following the
`node:test` + `node:assert/strict` pattern of sibling files like
`data/lib/method-category.test.ts`. Covers:

- Wins tallied into `winMethods` by category (ko_tko / submission /
  decision), losses tallied into `lossMethods` the same way.
- A win or loss with an "other" method (e.g. DQ) counts toward
  `wins`/`losses` but not toward any method bucket.
- `draws` still counted, independent of method.
- Empty fight list returns all-zero stats (including zeroed
  `winMethods`/`lossMethods`), and `upcoming`/`nc` results are not tallied
  anywhere — both already covered implicitly today, now asserted
  explicitly since this is the first test file for this module.
