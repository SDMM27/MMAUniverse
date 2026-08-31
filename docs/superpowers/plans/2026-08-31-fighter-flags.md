# Fighter Nationality Flags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show each fighter's nationality flag emoji everywhere a fighter appears — fighter pages, fight cards/rows, event pages, and fighter lists — on both the web app and the mobile (Expo) app.

**Architecture:** The flag-emoji conversion already exists and is already tested (`countryCodeToFlag` in `data/lib/flag-utils.ts` / `mobile/lib/flag-utils.ts`) and already used in both apps' `FightCard`. This plan (a) extends two `data/lib/data.ts` SQL fetchers that build fighter-shaped objects but currently drop the `nationality` column, sharing the fix with mobile since its API routes call the same functions, and (b) calls the existing `countryCodeToFlag` from every remaining component that renders a fighter's name/photo but doesn't yet show a flag.

**Tech Stack:** Next.js 14 (App Router) + `@neondatabase/serverless` tagged-template SQL on web; Expo/React Native + NativeWind on mobile. Verification throughout is `npx tsc --noEmit` (no component-level or SQL-fetcher tests exist in this codebase today — see the design doc's "Out of scope" section — so this plan doesn't invent new test infrastructure for them).

**Design doc:** `docs/superpowers/specs/2026-08-31-fighter-flags-design.md`

---

### Task 1: Data layer — `fetchRecentFinishedFights` nationality

**Files:**
- Modify: `data/lib/data.ts:393-481`

- [ ] **Step 1: Add the nationality columns to the query and its row type**

In `data/lib/data.ts`, find `fetchRecentFinishedFights` (starts at line 393). Its inline row type and SELECT list carry `f1_ranking`/`f2_ranking` but stop short of nationality (unlike the near-identical `fetchFightsByEvent` above it, which already has `f1_nationality`/`f2_nationality`). Add the two columns:

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
        f.id, f.event_id, f.fighter1_id, f.fighter2_id, f.fight_finished, f.winner_id, f.method, f.round, f.time, f.weight_class,
        e.name AS event_name, e.date AS event_date,
        o.abbreviation AS organization_abbreviation,
        f1.id AS f1_id, f1.name AS f1_name, f1.image_url AS f1_image_url, f1.weight_class AS f1_weight_class, f1.organization_id AS f1_organization_id, f1.record AS f1_record, f1.ranking AS f1_ranking, f1.nationality AS f1_nationality,
        f2.id AS f2_id, f2.name AS f2_name, f2.image_url AS f2_image_url, f2.weight_class AS f2_weight_class, f2.organization_id AS f2_organization_id, f2.record AS f2_record, f2.ranking AS f2_ranking, f2.nationality AS f2_nationality
      FROM fights f
      JOIN events e ON f.event_id = e.id
      JOIN organizations o ON e.organization_id = o.id
      LEFT JOIN fighters f1 ON f.fighter1_id = f1.id
      LEFT JOIN fighters f2 ON f.fighter2_id = f2.id
      WHERE f.fight_finished = true
      ORDER BY e.date DESC
      LIMIT ${limit}
    `;
```

Then add `nationality` to the mapped `fighter1`/`fighter2` objects further down in the same function:

```ts
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
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (the mapped objects now satisfy `Fighter`, which requires `nationality`).

- [ ] **Step 3: Commit**

```bash
git add data/lib/data.ts
git commit -m "feat(data): include fighter nationality in recent finished fights"
```

---

### Task 2: Data layer — `fetchFighterFightHistory` opponent nationality + type updates

**Files:**
- Modify: `data/lib/data.ts:275-391`
- Modify: `data/lib/definitions.ts:87-102`
- Modify: `mobile/lib/types.ts:54-67`

- [ ] **Step 1: Add `opponent_nationality` to the `upcoming` query**

In `data/lib/data.ts`, inside `fetchFighterFightHistory`, the `upcoming` query already `LEFT JOIN`s `fighters opponent`. Add the nationality column to its row type and SELECT list:

```ts
    const upcoming = await sql<{
      id: number;
      event_id: number;
      event_name: string;
      event_date: string;
      opponent_id: number | null;
      opponent_name: string | null;
      opponent_image_url: string | null;
      opponent_nationality: string | null;
    }>`
      SELECT
        f.id, f.event_id,
        e.name AS event_name, e.date AS event_date,
        opponent.id AS opponent_id, opponent.name AS opponent_name, opponent.image_url AS opponent_image_url, opponent.nationality AS opponent_nationality
      FROM fights f
      JOIN events e ON f.event_id = e.id
      LEFT JOIN fighters opponent ON opponent.id = (
        CASE WHEN f.fighter1_id = ANY(${fighterIds}) THEN f.fighter2_id ELSE f.fighter1_id END
      )
      WHERE (f.fighter1_id = ANY(${fighterIds}) OR f.fighter2_id = ANY(${fighterIds}))
        AND f.fight_finished = false
      ORDER BY e.date ASC
    `;
```

- [ ] **Step 2: Add `opponent_nationality` to the `history` query**

The `history` query resolves `opponent_id` via a correlated subquery matching `fhh.opponent_sherdog_url` against `fighters.sherdog_url` (there's no direct FK — `fighter_fight_history` rows are scraped independently). Add a second correlated subquery of the same shape, selecting `nationality`:

```ts
    const history = await sql<{
      id: number;
      opponent_name: string;
      opponent_sherdog_url: string | null;
      event_name: string;
      event_date: string | null;
      event_sherdog_url: string | null;
      event_id: number | null;
      opponent_id: number | null;
      opponent_nationality: string | null;
      result: string;
      method: string | null;
      referee: string | null;
      round: number | null;
      time: string | null;
    }>`
      SELECT
        fhh.id, fhh.opponent_name, fhh.opponent_sherdog_url, fhh.event_name, fhh.event_date, fhh.event_sherdog_url,
        fhh.result, fhh.method, fhh.referee, fhh.round, fhh.time,
        (
          SELECT e.id FROM events e WHERE e.name = fhh.event_name ORDER BY e.id ASC LIMIT 1
        ) AS event_id,
        (
          SELECT fi.id FROM fighters fi
          WHERE fhh.opponent_sherdog_url IS NOT NULL AND fi.sherdog_url = fhh.opponent_sherdog_url
          ORDER BY fi.id ASC LIMIT 1
        ) AS opponent_id,
        (
          SELECT fi.nationality FROM fighters fi
          WHERE fhh.opponent_sherdog_url IS NOT NULL AND fi.sherdog_url = fhh.opponent_sherdog_url
          ORDER BY fi.id ASC LIMIT 1
        ) AS opponent_nationality
      FROM fighter_fight_history fhh
      WHERE fhh.fighter_id = ANY(${fighterIds})
      ORDER BY fhh.event_date DESC NULLS LAST
    `;
```

- [ ] **Step 3: Map `opponent_nationality` into both entry lists**

Still in `fetchFighterFightHistory`, add the field to `upcomingEntries` and `historyEntries`:

```ts
    const upcomingEntries: FightHistoryEntry[] = upcoming.rows.map((row) => ({
      id: `upcoming-${row.id}`,
      event_id: row.event_id,
      event_name: row.event_name,
      event_date: row.event_date,
      event_sherdog_url: null,
      opponent_id: row.opponent_id,
      opponent_name: row.opponent_name,
      opponent_image_url: row.opponent_image_url,
      opponent_sherdog_url: null,
      opponent_nationality: row.opponent_nationality,
      result: 'upcoming',
      method: null,
      referee: null,
      round: null,
      time: null,
    }));

    const historyEntries: FightHistoryEntry[] = dedupedHistory.map((row) => ({
      id: `history-${row.id}`,
      event_id: row.event_id,
      event_name: row.event_name,
      event_date: row.event_date ?? '',
      event_sherdog_url: row.event_sherdog_url,
      opponent_id: row.opponent_id,
      opponent_name: row.opponent_name,
      opponent_image_url: null,
      opponent_sherdog_url: row.opponent_sherdog_url,
      opponent_nationality: row.opponent_nationality,
      result: (row.result as FightHistoryEntry['result']) ?? 'draw',
      method: row.method,
      referee: row.referee,
      round: row.round,
      time: row.time,
    }));
```

- [ ] **Step 4: Add the field to the `FightHistoryEntry` type (web)**

In `data/lib/definitions.ts`, add `opponent_nationality` to `FightHistoryEntry`:

```ts
export type FightHistoryEntry = {
  id: string;
  event_id: number | null;
  event_name: string;
  event_date: string;
  event_sherdog_url: string | null;
  opponent_id: number | null;
  opponent_name: string | null;
  opponent_image_url: string | null;
  opponent_sherdog_url: string | null;
  opponent_nationality: string | null;
  result: 'win' | 'loss' | 'draw' | 'nc' | 'upcoming';
  method: string | null;
  referee: string | null;
  round: number | null;
  time: string | null;
};
```

- [ ] **Step 5: Mirror the field on mobile's `FightHistoryEntry`**

In `mobile/lib/types.ts`, this type is hand-kept in sync with the web one (per its own doc comment). Add the same field:

```ts
// Mirrors data/lib/definitions.ts's FightHistoryEntry on the web side — see
// that file's comment for how upcoming vs. completed fights are sourced.
export type FightHistoryEntry = {
  id: string;
  event_id: number | null;
  event_name: string;
  event_date: string;
  event_sherdog_url: string | null;
  opponent_name: string | null;
  opponent_image_url: string | null;
  opponent_nationality: string | null;
  result: 'win' | 'loss' | 'draw' | 'nc' | 'upcoming';
  method: string | null;
  referee: string | null;
  round: number | null;
  time: string | null;
};
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Run the existing web test suite**

Run: `npm test`
Expected: all existing tests still pass (this task doesn't touch any tested pure function, but confirms nothing else broke).

- [ ] **Step 8: Commit**

```bash
git add data/lib/data.ts data/lib/definitions.ts mobile/lib/types.ts
git commit -m "feat(data): carry opponent nationality through fighter fight history"
```

---

### Task 3: Web — flag on the fighter list card

**Files:**
- Modify: `components/ui/fighters/fighter-card.tsx`

- [ ] **Step 1: Add the flag next to the fighter's name**

Replace the full contents of `components/ui/fighters/fighter-card.tsx`:

```tsx
import Link from 'next/link';
import { CoverImage } from '@/components/ui/shared/media';
import { FighterWithOrganization } from '@/data/lib/definitions';
import { countryCodeToFlag } from '@/data/lib/flag-utils';

export default function FighterCard({ fighter }: { fighter: FighterWithOrganization }) {
  const flag = countryCodeToFlag(fighter.nationality);

  return (
    <Link
      href={`/fighters/${fighter.id}`}
      className="flex flex-col overflow-hidden rounded-lg border border-base-border bg-base-card transition-colors hover:border-accent"
    >
      <CoverImage
        src={fighter.image_url}
        alt={fighter.name}
        className="aspect-square w-full"
        objectPosition="top"
      />
      <div className="flex flex-col gap-1 p-3">
        <span className="font-display text-xs uppercase tracking-wide text-accent">
          {fighter.organization_abbreviation}
        </span>
        <p className="flex items-center gap-1.5 font-display text-sm uppercase tracking-wide text-ink-primary">
          {flag && <span aria-hidden="true">{flag}</span>}
          <span className="min-w-0 truncate">{fighter.name}</span>
        </p>
        <p className="text-xs text-ink-secondary">
          {fighter.weight_class} · {fighter.record}
        </p>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/ui/fighters/fighter-card.tsx
git commit -m "feat(ui): show fighter nationality flag on fighter cards"
```

---

### Task 4: Web — flag on fight rows

**Files:**
- Modify: `components/ui/fights/fight-row.tsx`

This is the highest-leverage single change: `FightRow` is reused by the home page's "Combats à venir" and "Derniers résultats" (via `FightResultRow`) and the event page's undercard list.

- [ ] **Step 1: Add the flag in `FighterSide`**

In `components/ui/fights/fight-row.tsx`, add the import:

```ts
import { countryCodeToFlag } from '@/data/lib/flag-utils';
```

Then replace the `FighterSide` function with:

```tsx
function FighterSide({
  fighter,
  align,
  outcome,
}: {
  fighter: Fighter;
  align: 'left' | 'right';
  outcome: FightOutcome | null;
}) {
  const flag = countryCodeToFlag(fighter.nationality);

  return (
    // min-w-0 on both this Link and the div below: a flex item's default
    // min-width is the width of its content — without it at *every* nested
    // flex level between the row and the actual text, a long fighter name
    // refuses to shrink and pushes the row (and the page, on narrow screens)
    // wider than its container. Setting it only on the innermost div isn't
    // enough; this Link is itself the flex item FightRow needs to shrink.
    <Link
      href={`/fighters/${fighter.id}`}
      className={`flex min-w-0 flex-1 items-center gap-3 rounded-md transition-colors hover:text-accent ${align === 'right' ? 'flex-row-reverse text-right' : ''}`}
    >
      <CoverImage
        src={fighter.image_url}
        alt={fighter.name}
        className="h-16 w-16 shrink-0 rounded-md"
        objectPosition="top"
      />
      <div className="min-w-0">
        <div className={`flex items-center gap-2 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
          {outcome && (
            <span className={`shrink-0 font-display text-sm font-bold ${outcomeColor[outcome]}`} aria-hidden="true">
              {outcomeLabel[outcome]}
            </span>
          )}
          {flag && (
            <span className="shrink-0 text-sm" aria-hidden="true">
              {flag}
            </span>
          )}
          <p
            className={`truncate font-display text-base uppercase tracking-wide ${outcome === 'loss' ? 'text-ink-secondary' : 'text-ink-primary'}`}
          >
            {fighter.name}
          </p>
        </div>
        <p className="text-sm text-ink-secondary">
          {fighter.record}
          {outcome === 'win' && <span className="ml-1.5 text-win">Vainqueur</span>}
        </p>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/ui/fights/fight-row.tsx
git commit -m "feat(ui): show fighter nationality flag on fight rows"
```

---

### Task 5: Web — flag on the fighter detail page header

**Files:**
- Modify: `app/fighters/[slug]/page.tsx`

- [ ] **Step 1: Replace the raw nationality text with the flag**

In `app/fighters/[slug]/page.tsx`, add the import:

```ts
import { countryCodeToFlag } from '@/data/lib/flag-utils';
```

Add the computed flag right after `const fighter = await fetchFighterById(params.slug);`'s null check (i.e. after the `notFound()` block, once `fighter` is known non-null):

```ts
  const fights = await fetchFighterFightHistory(params.slug);
  const stats = computeFighterStats(fights);
  const flag = countryCodeToFlag(fighter.nationality);
```

Then replace this line:

```tsx
                {fighter.nationality && <span>{fighter.nationality}</span>}
```

with:

```tsx
                {flag && (
                  <span className="text-base" aria-hidden="true">
                    {flag}
                  </span>
                )}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/fighters/[slug]/page.tsx
git commit -m "feat(ui): show fighter nationality flag on fighter page header"
```

---

### Task 6: Web — flag on opponent names in the fighter history table

**Files:**
- Modify: `components/ui/fighters/fighter-history-list.tsx`

- [ ] **Step 1: Add the flag next to each opponent's name**

In `components/ui/fighters/fighter-history-list.tsx`, add the import:

```ts
import { countryCodeToFlag } from '@/data/lib/flag-utils';
```

Then replace the `<tbody>` block with:

```tsx
        <tbody>
          {fights.map((fight, i) => {
            const opponentFlag = countryCodeToFlag(fight.opponent_nationality);

            return (
              <tr key={fight.id} className={i % 2 === 1 ? 'bg-base-card/50' : undefined}>
                <td className="p-3 align-top">
                  <span
                    className={`inline-block rounded px-2 py-1 font-display text-xs uppercase tracking-wide ${resultBadgeColor[fight.result as Exclude<FightHistoryEntry['result'], 'upcoming'>]}`}
                  >
                    {resultLabel[fight.result as Exclude<FightHistoryEntry['result'], 'upcoming'>]}
                  </span>
                </td>
                <td className="p-3 align-top text-ink-primary">
                  <span className="inline-flex items-center gap-1.5">
                    {opponentFlag && <span aria-hidden="true">{opponentFlag}</span>}
                    {fight.opponent_id ? (
                      <Link href={`/fighters/${fight.opponent_id}`} className="text-accent hover:underline">
                        {fight.opponent_name ?? 'Adversaire inconnu'}
                      </Link>
                    ) : fight.opponent_sherdog_url ? (
                      <a
                        href={fight.opponent_sherdog_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-accent hover:underline"
                      >
                        {fight.opponent_name ?? 'Adversaire inconnu'}
                      </a>
                    ) : (
                      (fight.opponent_name ?? 'Adversaire inconnu')
                    )}
                  </span>
                </td>
                <td className="p-3 align-top">
                  {fight.event_id ? (
                    <Link href={`/events/${fight.event_id}`} className="text-accent hover:underline">
                      {fight.event_name}
                    </Link>
                  ) : fight.event_sherdog_url ? (
                    <a href={fight.event_sherdog_url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                      {fight.event_name}
                    </a>
                  ) : (
                    <span className="text-ink-primary">{fight.event_name}</span>
                  )}
                  <p className="text-xs text-ink-secondary">{fight.event_date}</p>
                </td>
                <td className="p-3 align-top text-ink-primary">
                  {fight.method || '—'}
                  {fight.referee && <p className="text-xs text-ink-secondary">{fight.referee}</p>}
                </td>
                <td className="p-3 align-top text-ink-primary">{fight.round ?? '—'}</td>
                <td className="p-3 align-top text-ink-primary">{fight.time || '—'}</td>
              </tr>
            );
          })}
        </tbody>
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/ui/fighters/fighter-history-list.tsx
git commit -m "feat(ui): show opponent nationality flag in fighter history table"
```

---

### Task 7: Web — flag badges on the home page matchup hero

**Files:**
- Modify: `components/ui/events/next-event-hero.tsx`

- [ ] **Step 1: Add a flag badge on each fighter's photo panel**

In `components/ui/events/next-event-hero.tsx`, add the import:

```ts
import { countryCodeToFlag } from '@/data/lib/flag-utils';
```

Compute both flags right after the existing `hasMatchup`/`eventTime` calculations:

```ts
  const hasMatchup = Boolean(fighter1?.image_url && fighter2?.image_url);
  const eventTime = formatEventTime(event.main_card_start) ?? formatEventTime(event.start_time);
  const flag1 = countryCodeToFlag(fighter1?.nationality ?? null);
  const flag2 = countryCodeToFlag(fighter2?.nationality ?? null);
```

Then replace the `hasMatchup` branch of the JSX (the `<div className="absolute inset-0 flex">...</div>` block) with:

```tsx
      {hasMatchup ? (
        <div className="absolute inset-0 flex">
          {/* This box is far wider than it is tall, so only ~40% of the
              source portrait's height ever shows. `top` (0%) crops down to
              hairline only; centering the window a bit below the very top
              keeps the whole face (eyes through chin) in frame instead. */}
          <div className="relative h-full w-1/2">
            <CoverImage
              src={fighter1!.image_url}
              alt={fighter1!.name}
              className="h-full w-full"
              sizes="50vw"
              objectPosition="50% 20%"
            />
            {flag1 && (
              <span
                aria-hidden="true"
                className="absolute bottom-2 left-2 rounded bg-base-bg/70 px-1.5 py-0.5 text-lg leading-none backdrop-blur-sm sm:text-xl"
              >
                {flag1}
              </span>
            )}
          </div>
          <div className="relative h-full w-1/2">
            <CoverImage
              src={fighter2!.image_url}
              alt={fighter2!.name}
              className="h-full w-full"
              sizes="50vw"
              objectPosition="50% 20%"
            />
            {flag2 && (
              <span
                aria-hidden="true"
                className="absolute bottom-2 right-2 rounded bg-base-bg/70 px-1.5 py-0.5 text-lg leading-none backdrop-blur-sm sm:text-xl"
              >
                {flag2}
              </span>
            )}
          </div>
          <span
            aria-hidden="true"
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-display text-2xl italic text-white [text-shadow:0_2px_16px_rgba(0,0,0,0.85)] sm:text-4xl"
          >
            VS
          </span>
        </div>
      ) : (
        <CoverImage src={event.event_poster} alt={event.name} className="absolute inset-0 h-full w-full" />
      )}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/ui/events/next-event-hero.tsx
git commit -m "feat(ui): show fighter nationality flags on home page matchup hero"
```

---

### Task 8: Mobile — flags on `FighterCard` and `FightRow`

**Files:**
- Modify: `mobile/components/cards.tsx`

- [ ] **Step 1: Add the flag to `FighterCard`**

`countryCodeToFlag` is already imported at the top of `mobile/components/cards.tsx` (used by `FightCard` further down). Replace the `FighterCard` function with:

```tsx
export function FighterCard({ fighter, onPress }: { fighter: FighterWithOrganization; onPress: () => void }) {
  const flag = countryCodeToFlag(fighter.nationality);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${fighter.name}, ${fighter.record}`}
      className="flex-row items-center gap-3 rounded-lg border border-base-border bg-base-card p-3"
    >
      <Image source={{ uri: fighter.image_url }} accessible={false} className="h-12 w-12 rounded-full" />
      <View className="flex-1">
        <Text className="text-base font-semibold text-ink-primary">
          {flag ? `${flag} ` : ''}
          {fighter.name}
        </Text>
        <Text className="text-xs text-ink-secondary">
          {fighter.organization_abbreviation} · {fighter.weight_class} · {fighter.record}
        </Text>
      </View>
    </Pressable>
  );
}
```

- [ ] **Step 2: Add flags to `FightRow`**

Replace the `FightRow` function with:

```tsx
export function FightRow({ fight }: { fight: FightWithFighters }) {
  const winnerName =
    fight.winner_id === fight.fighter1?.id
      ? fight.fighter1?.name
      : fight.winner_id === fight.fighter2?.id
        ? fight.fighter2?.name
        : null;
  const flag1 = countryCodeToFlag(fight.fighter1?.nationality ?? null);
  const flag2 = countryCodeToFlag(fight.fighter2?.nationality ?? null);

  return (
    <View className="rounded-lg border border-base-border bg-base-card p-3">
      <Text className="text-xs uppercase tracking-wide text-ink-secondary">{fight.weight_class}</Text>
      <View className="flex-row items-center justify-between py-1">
        <Text
          className={`flex-1 text-base font-semibold ${fight.winner_id === fight.fighter1?.id ? 'text-accent' : 'text-ink-primary'}`}
        >
          {flag1 ? `${flag1} ` : ''}
          {fight.fighter1?.name ?? 'TBD'}
        </Text>
        <Text className="px-2 text-ink-secondary">vs</Text>
        <Text
          className={`flex-1 text-right text-base font-semibold ${fight.winner_id === fight.fighter2?.id ? 'text-accent' : 'text-ink-primary'}`}
        >
          {fight.fighter2?.name ?? 'TBD'}
          {flag2 ? ` ${flag2}` : ''}
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

- [ ] **Step 3: Typecheck**

Run (from the `mobile/` directory): `cd mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add mobile/components/cards.tsx
git commit -m "feat(mobile): show fighter nationality flags on fighter card and fight row"
```

---

### Task 9: Mobile — flags on the fighter detail screen

**Files:**
- Modify: `mobile/app/(tabs)/fighters/[id].tsx`

- [ ] **Step 1: Add the flag to the header and to each history row**

Replace the full contents of `mobile/app/(tabs)/fighters/[id].tsx`:

```tsx
import { View, Text, Image, FlatList } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { getFighter } from '../../../lib/api';
import { useApi } from '../../../lib/use-api';
import { countryCodeToFlag } from '../../../lib/flag-utils';
import { Loading, ErrorState, EmptyState } from '../../../components/state';
import FighterRecordCard from '../../../components/fighter-record-card';

const RESULT_LABEL: Record<string, string> = { win: 'V', loss: 'D', draw: 'N', nc: 'SD', upcoming: 'À venir' };
const RESULT_COLOR: Record<string, string> = {
  win: 'text-accent',
  loss: 'text-ink-secondary',
  draw: 'text-ink-secondary',
  nc: 'text-ink-secondary',
  upcoming: 'text-ink-secondary',
};

export default function FighterDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [state, reload] = useApi(() => getFighter(id), [id]);

  if (state.status === 'loading') return <Loading />;
  if (state.status === 'error') return <ErrorState message={state.message} onRetry={reload} />;

  const { fighter, fights, stats } = state.data;
  const flag = countryCodeToFlag(fighter.nationality);

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
              <Text className="font-display text-2xl uppercase text-ink-primary">
                {flag ? `${flag} ` : ''}
                {fighter.name}
              </Text>
              <Text className="text-sm text-ink-secondary">{fighter.record}</Text>
            </View>
          </View>
          <FighterRecordCard stats={stats} />
          <Text className="font-display text-lg uppercase text-ink-primary">Historique</Text>
        </View>
      }
      ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      ListEmptyComponent={<EmptyState message="Aucun combat enregistré." />}
      renderItem={({ item }) => {
        const opponentFlag = countryCodeToFlag(item.opponent_nationality);

        return (
          <View className="flex-row items-center justify-between rounded-lg border border-base-border bg-base-card p-3">
            <View>
              <Text className="text-base font-semibold text-ink-primary">
                vs {opponentFlag ? `${opponentFlag} ` : ''}
                {item.opponent_name ?? 'Adversaire inconnu'}
              </Text>
              <Text className="text-xs text-ink-secondary">
                {item.event_name} · {item.event_date}
              </Text>
            </View>
            <Text className={`font-display text-lg ${RESULT_COLOR[item.result]}`}>{RESULT_LABEL[item.result]}</Text>
          </View>
        );
      }}
    />
  );
}
```

- [ ] **Step 2: Typecheck**

Run (from the `mobile/` directory): `cd mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "mobile/app/(tabs)/fighters/[id].tsx"
git commit -m "feat(mobile): show fighter nationality flags on fighter detail screen"
```

---

## Summary of surfaces covered

| Surface | Web | Mobile |
|---|---|---|
| Fight card (main event) | already had it | already had it |
| Fighter list / grid | Task 3 | Task 8 |
| Fight row (undercard, home, results) | Task 4 | Task 8 |
| Fighter detail header | Task 5 | Task 9 |
| Fighter history table (opponent) | Task 6 | Task 9 |
| Home matchup hero | Task 7 | n/a (mobile has no equivalent hero component) |
