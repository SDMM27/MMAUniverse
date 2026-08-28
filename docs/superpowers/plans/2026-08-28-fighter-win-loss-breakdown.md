# Fighter Win/Loss Method Breakdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fighter detail page's minimal win/loss stats (web: 3-box grid; mobile: one-line summary) with a Sherdog-style two-column card showing, for both wins and losses, the total plus a KO/TKO · Submissions · Decisions breakdown with counts and percentages.

**Architecture:** Extend the shared `FighterStats` shape (mirrored in `data/lib/definitions.ts` and `mobile/lib/types.ts`) to carry a `winMethods`/`lossMethods` breakdown instead of a wins-only one; rewrite `computeFighterStats` to tally both sides using the existing, already-tested `normalizeMethodCategory` util (deleting the duplicate, looser `categorizeMethod` it currently has); add one new presentational component per platform (`FighterRecordCard`) that renders the two-column card and computes percentages at render time; wire each into its fighter detail page/screen, replacing the old stat display entirely.

**Tech Stack:** Next.js (App Router) + Tailwind CSS on web, Expo Router + React Native + NativeWind on mobile, Node's built-in test runner (`node:test`) via `tsx`.

Design spec: [`docs/superpowers/specs/2026-08-28-fighter-win-loss-breakdown-design.md`](../specs/2026-08-28-fighter-win-loss-breakdown-design.md)

---

### Task 1: Update the `FighterStats` type on both platforms

**Files:**
- Modify: `data/lib/definitions.ts:84-91`
- Modify: `mobile/lib/types.ts:69-76`

- [ ] **Step 1: Update the web type definition**

In `data/lib/definitions.ts`, replace:

```ts
export type FighterStats = {
  wins: number;
  losses: number;
  draws: number;
  ko: number;
  submission: number;
  decision: number;
};
```

with:

```ts
export type MethodBreakdown = {
  koTko: number;
  submission: number;
  decision: number;
};

export type FighterStats = {
  wins: number;
  losses: number;
  draws: number;
  winMethods: MethodBreakdown;
  lossMethods: MethodBreakdown;
};
```

- [ ] **Step 2: Mirror the change on mobile**

In `mobile/lib/types.ts`, replace:

```ts
export type FighterStats = {
  wins: number;
  losses: number;
  draws: number;
  ko: number;
  submission: number;
  decision: number;
};
```

with:

```ts
export type MethodBreakdown = {
  koTko: number;
  submission: number;
  decision: number;
};

export type FighterStats = {
  wins: number;
  losses: number;
  draws: number;
  winMethods: MethodBreakdown;
  lossMethods: MethodBreakdown;
};
```

- [ ] **Step 3: Confirm the expected (temporary) breakage**

`data/lib/fighter-stats.ts` still builds the old shape, so it now mismatches
`FighterStats`. Run:

```bash
npx tsc --noEmit
```

Expected: error in `data/lib/fighter-stats.ts` about `ko`/`submission`/`decision`/`winMethods`/`lossMethods` not matching — this is fixed in Task 2. Do not fix it here.

- [ ] **Step 4: Commit**

```bash
git add data/lib/definitions.ts mobile/lib/types.ts
git commit -m "feat(types): add winMethods/lossMethods to FighterStats"
```

---

### Task 2: Rewrite `computeFighterStats` (TDD)

**Files:**
- Create: `data/lib/fighter-stats.test.ts`
- Modify: `data/lib/fighter-stats.ts`

- [ ] **Step 1: Write the failing tests**

Create `data/lib/fighter-stats.test.ts`:

```ts
// data/lib/fighter-stats.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeFighterStats } from './fighter-stats';

test('computeFighterStats tallies win methods by category', () => {
  const stats = computeFighterStats([
    { method: 'TKO (Punches)', result: 'win' },
    { method: 'Submission (Rear-Naked Choke)', result: 'win' },
    { method: 'Decision (Unanimous)', result: 'win' },
  ]);

  assert.equal(stats.wins, 3);
  assert.deepEqual(stats.winMethods, { koTko: 1, submission: 1, decision: 1 });
});

test('computeFighterStats tallies loss methods by category', () => {
  const stats = computeFighterStats([
    { method: 'KO (Head Kick)', result: 'loss' },
    { method: 'Technical Submission (Kimura)', result: 'loss' },
    { method: 'Technical Decision (Majority)', result: 'loss' },
  ]);

  assert.equal(stats.losses, 3);
  assert.deepEqual(stats.lossMethods, { koTko: 1, submission: 1, decision: 1 });
});

test('computeFighterStats counts a win or loss with an unclassifiable method toward the total but not any method bucket', () => {
  const stats = computeFighterStats([
    { method: 'Disqualification (Biting)', result: 'win' },
    { method: 'No Contest', result: 'loss' },
  ]);

  assert.equal(stats.wins, 1);
  assert.equal(stats.losses, 1);
  assert.deepEqual(stats.winMethods, { koTko: 0, submission: 0, decision: 0 });
  assert.deepEqual(stats.lossMethods, { koTko: 0, submission: 0, decision: 0 });
});

test('computeFighterStats counts draws independent of method', () => {
  const stats = computeFighterStats([{ method: 'Draw (Majority)', result: 'draw' }]);

  assert.equal(stats.draws, 1);
  assert.deepEqual(stats.winMethods, { koTko: 0, submission: 0, decision: 0 });
  assert.deepEqual(stats.lossMethods, { koTko: 0, submission: 0, decision: 0 });
});

test('computeFighterStats ignores upcoming and no-contest results', () => {
  const stats = computeFighterStats([
    { method: null, result: 'upcoming' },
    { method: 'No Contest (Accidental Clash of Heads)', result: 'nc' },
  ]);

  assert.deepEqual(stats, {
    wins: 0,
    losses: 0,
    draws: 0,
    winMethods: { koTko: 0, submission: 0, decision: 0 },
    lossMethods: { koTko: 0, submission: 0, decision: 0 },
  });
});

test('computeFighterStats returns all-zero stats for an empty fight list', () => {
  const stats = computeFighterStats([]);

  assert.deepEqual(stats, {
    wins: 0,
    losses: 0,
    draws: 0,
    winMethods: { koTko: 0, submission: 0, decision: 0 },
    lossMethods: { koTko: 0, submission: 0, decision: 0 },
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx tsx --test data/lib/fighter-stats.test.ts`
Expected: FAIL — `stats.winMethods` is `undefined` (current implementation still returns `{ wins, losses, draws, ko, submission, decision }`), so the `assert.deepEqual` calls throw.

- [ ] **Step 3: Rewrite the implementation**

Replace the full contents of `data/lib/fighter-stats.ts` with:

```ts
import { normalizeMethodCategory } from './method-category';
import { FighterStats, MethodBreakdown, MethodCategory } from './definitions';

type ScorableFight = {
  method: string | null;
  // 'nc' (no contest) falls through untallied below, same as 'upcoming' —
  // neither counts toward a fighter's win/loss/draw record.
  result: 'win' | 'loss' | 'draw' | 'nc' | 'upcoming';
};

function emptyMethodBreakdown(): MethodBreakdown {
  return { koTko: 0, submission: 0, decision: 0 };
}

// Bucket a win/loss by method category. Categories other than the three
// trackable ones (e.g. disqualification, an unresolvable "No Contest" method
// string) still count toward the fighter's win/loss total via the caller —
// they're just not represented in any method bucket, so the three buckets
// can sum to less than the total.
function tally(target: MethodBreakdown, category: MethodCategory | 'other'): void {
  if (category === 'ko_tko') target.koTko += 1;
  else if (category === 'submission') target.submission += 1;
  else if (category === 'decision') target.decision += 1;
}

export function computeFighterStats(fights: ScorableFight[]): FighterStats {
  const stats: FighterStats = {
    wins: 0,
    losses: 0,
    draws: 0,
    winMethods: emptyMethodBreakdown(),
    lossMethods: emptyMethodBreakdown(),
  };

  for (const fight of fights) {
    if (fight.result === 'win') {
      stats.wins += 1;
      tally(stats.winMethods, normalizeMethodCategory(fight.method ?? ''));
    } else if (fight.result === 'loss') {
      stats.losses += 1;
      tally(stats.lossMethods, normalizeMethodCategory(fight.method ?? ''));
    } else if (fight.result === 'draw') {
      stats.draws += 1;
    }
  }

  return stats;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx tsx --test data/lib/fighter-stats.test.ts`
Expected: PASS — all 6 tests green.

- [ ] **Step 5: Run the full test suite to confirm nothing else broke**

Run: `npm test`
Expected: PASS — every `data/**/*.test.ts` file passes, including the new one.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (the mismatch from Task 1 is now resolved).

- [ ] **Step 7: Commit**

```bash
git add data/lib/fighter-stats.ts data/lib/fighter-stats.test.ts
git commit -m "feat(stats): tally win/loss method breakdown via normalizeMethodCategory"
```

---

### Task 3: Web `FighterRecordCard` component

**Files:**
- Create: `components/ui/fighters/fighter-record-card.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { FighterStats, MethodBreakdown } from '@/data/lib/definitions';

function pct(count: number, total: number): number {
  return total === 0 ? 0 : Math.round((count / total) * 100);
}

function MethodRow({
  label,
  count,
  total,
  barColorClass,
}: {
  label: string;
  count: number;
  total: number;
  barColorClass: string;
}) {
  const percentage = pct(count, total);
  return (
    <div className="mb-2 last:mb-0">
      <div className="flex items-center justify-between text-xs uppercase tracking-wide text-ink-secondary">
        <span>{label}</span>
        <span className="font-semibold text-ink-primary">
          {count} · {percentage}%
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-base-border">
        <div className={`h-full rounded-full ${barColorClass}`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

function RecordColumn({
  label,
  total,
  methods,
  badgeClass,
  barColorClass,
}: {
  label: string;
  total: number;
  methods: MethodBreakdown;
  badgeClass: string;
  barColorClass: string;
}) {
  return (
    <div className="flex-1">
      <div className="mb-2 flex items-baseline gap-2">
        <span className={`rounded px-2 py-0.5 font-display text-xs font-bold uppercase tracking-wide ${badgeClass}`}>
          {label}
        </span>
        <span className="font-display text-xl text-ink-primary">{total}</span>
      </div>
      <MethodRow label="KO/TKO" count={methods.koTko} total={total} barColorClass={barColorClass} />
      <MethodRow label="Soumissions" count={methods.submission} total={total} barColorClass={barColorClass} />
      <MethodRow label="Décisions" count={methods.decision} total={total} barColorClass={barColorClass} />
    </div>
  );
}

export default function FighterRecordCard({ stats }: { stats: FighterStats }) {
  return (
    <div className="rounded-lg border border-base-border bg-base-card p-4">
      {stats.draws > 0 && (
        <p className="mb-3 text-xs text-ink-secondary">
          {stats.wins}-{stats.losses} · {stats.draws} nul{stats.draws > 1 ? 's' : ''}
        </p>
      )}
      <div className="flex gap-4">
        <RecordColumn
          label="Victoires"
          total={stats.wins}
          methods={stats.winMethods}
          badgeClass="bg-win text-base-bg"
          barColorClass="bg-win"
        />
        <div className="w-px bg-base-border" />
        <RecordColumn
          label="Défaites"
          total={stats.losses}
          methods={stats.lossMethods}
          badgeClass="bg-accent text-ink-primary"
          barColorClass="bg-accent"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/ui/fighters/fighter-record-card.tsx
git commit -m "feat(web): add FighterRecordCard component"
```

---

### Task 4: Wire `FighterRecordCard` into the web fighter detail page

**Files:**
- Modify: `app/fighters/[slug]/page.tsx`

- [ ] **Step 1: Replace the import and the stat grid**

In `app/fighters/[slug]/page.tsx`, replace:

```tsx
import { notFound } from 'next/navigation';
import { fetchFighterById, fetchFighterFightHistory } from '@/data/lib/data';
import { computeFighterStats } from '@/data/lib/fighter-stats';
import { CoverImage } from '@/components/ui/shared/media';
import FighterHistoryList from '@/components/ui/fighters/fighter-history-list';
import EmptyState from '@/components/ui/shared/empty-state';
```

with:

```tsx
import { notFound } from 'next/navigation';
import { fetchFighterById, fetchFighterFightHistory } from '@/data/lib/data';
import { computeFighterStats } from '@/data/lib/fighter-stats';
import { CoverImage } from '@/components/ui/shared/media';
import FighterHistoryList from '@/components/ui/fighters/fighter-history-list';
import FighterRecordCard from '@/components/ui/fighters/fighter-record-card';
import EmptyState from '@/components/ui/shared/empty-state';
```

Then replace:

```tsx
      <div className="grid grid-cols-3 gap-3">
        <StatBox label="Wins" value={stats.wins} />
        <StatBox label="Losses" value={stats.losses} />
        <StatBox label="KO" value={stats.ko} />
      </div>
```

with:

```tsx
      <FighterRecordCard stats={stats} />
```

Then delete the now-unused helper at the bottom of the file:

```tsx
function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-base-border bg-base-card p-3 text-center">
      <p className="font-display text-xl text-ink-primary">{value}</p>
      <p className="text-xs uppercase tracking-wide text-ink-secondary">{label}</p>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (in particular, no "StatBox is declared but never used" — it's fully removed, not just unreferenced).

- [ ] **Step 3: Commit**

```bash
git add app/fighters/[slug]/page.tsx
git commit -m "feat(web): replace fighter stat grid with FighterRecordCard"
```

---

### Task 5: Mobile `FighterRecordCard` component

**Files:**
- Create: `mobile/components/fighter-record-card.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { View, Text } from 'react-native';
import type { FighterStats, MethodBreakdown } from '../lib/types';

function pct(count: number, total: number): number {
  return total === 0 ? 0 : Math.round((count / total) * 100);
}

function MethodRow({
  label,
  count,
  total,
  barColor,
}: {
  label: string;
  count: number;
  total: number;
  barColor: string;
}) {
  const percentage = pct(count, total);
  return (
    <View className="mb-2">
      <View className="flex-row items-center justify-between">
        <Text className="text-xs uppercase tracking-wide text-ink-secondary">{label}</Text>
        <Text className="text-xs font-semibold text-ink-primary">
          {count} · {percentage}%
        </Text>
      </View>
      <View className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-base-border">
        <View className={`h-full rounded-full ${barColor}`} style={{ width: `${percentage}%` }} />
      </View>
    </View>
  );
}

function RecordColumn({
  label,
  total,
  methods,
  badgeBg,
  badgeText,
  barColor,
}: {
  label: string;
  total: number;
  methods: MethodBreakdown;
  badgeBg: string;
  badgeText: string;
  barColor: string;
}) {
  return (
    <View className="flex-1">
      <View className="mb-2 flex-row items-center gap-2">
        <View className={`rounded px-2 py-0.5 ${badgeBg}`}>
          <Text className={`font-display text-xs uppercase tracking-wide ${badgeText}`}>{label}</Text>
        </View>
        <Text className="font-display text-xl text-ink-primary">{total}</Text>
      </View>
      <MethodRow label="KO/TKO" count={methods.koTko} total={total} barColor={barColor} />
      <MethodRow label="Soumissions" count={methods.submission} total={total} barColor={barColor} />
      <MethodRow label="Décisions" count={methods.decision} total={total} barColor={barColor} />
    </View>
  );
}

export default function FighterRecordCard({ stats }: { stats: FighterStats }) {
  return (
    <View className="rounded-lg border border-base-border bg-base-card p-3">
      {stats.draws > 0 && (
        <Text className="mb-3 text-xs text-ink-secondary">
          {stats.wins}-{stats.losses} · {stats.draws} nul{stats.draws > 1 ? 's' : ''}
        </Text>
      )}
      <View className="flex-row gap-4">
        <RecordColumn
          label="Victoires"
          total={stats.wins}
          methods={stats.winMethods}
          badgeBg="bg-win"
          badgeText="text-base-bg"
          barColor="bg-win"
        />
        <View className="w-px bg-base-border" />
        <RecordColumn
          label="Défaites"
          total={stats.losses}
          methods={stats.lossMethods}
          badgeBg="bg-accent"
          badgeText="text-ink-primary"
          barColor="bg-accent"
        />
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p mobile/tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add mobile/components/fighter-record-card.tsx
git commit -m "feat(mobile): add FighterRecordCard component"
```

---

### Task 6: Wire `FighterRecordCard` into the mobile fighter screen

**Files:**
- Modify: `mobile/app/(tabs)/fighters/[id].tsx`

- [ ] **Step 1: Replace the import and the stats row**

In `mobile/app/(tabs)/fighters/[id].tsx`, replace:

```tsx
import { View, Text, Image, FlatList } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { getFighter } from '../../../lib/api';
import { useApi } from '../../../lib/use-api';
import { Loading, ErrorState, EmptyState } from '../../../components/state';
```

with:

```tsx
import { View, Text, Image, FlatList } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { getFighter } from '../../../lib/api';
import { useApi } from '../../../lib/use-api';
import { Loading, ErrorState, EmptyState } from '../../../components/state';
import FighterRecordCard from '../../../components/fighter-record-card';
```

Then replace:

```tsx
          <View className="flex-row justify-between rounded-lg border border-base-border bg-base-card p-3">
            <Text className="text-ink-secondary">V {stats.wins}</Text>
            <Text className="text-ink-secondary">D {stats.losses}</Text>
            <Text className="text-ink-secondary">N {stats.draws}</Text>
            <Text className="text-ink-secondary">KO {stats.ko}</Text>
            <Text className="text-ink-secondary">Sub {stats.submission}</Text>
            <Text className="text-ink-secondary">Déc {stats.decision}</Text>
          </View>
```

with:

```tsx
          <FighterRecordCard stats={stats} />
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p mobile/tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "mobile/app/(tabs)/fighters/[id].tsx"
git commit -m "feat(mobile): replace fighter stats row with FighterRecordCard"
```

---

### Task 7: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full web test suite**

Run: `npm test`
Expected: PASS — all tests green, including the 6 new `fighter-stats.test.ts` cases.

- [ ] **Step 2: Typecheck both projects**

Run:
```bash
npx tsc --noEmit
npx tsc --noEmit -p mobile/tsconfig.json
```
Expected: no errors from either command.

- [ ] **Step 3: Visual smoke check on web**

Start the web dev server (`npm run dev`, or via the project's preview tooling using
the `mma-universe-dev` launch config), open `/fighters`, click into any fighter
with a non-empty record, and confirm on the detail page:
- The old 3-box grid is gone.
- A two-column card shows "VICTOIRES" (green badge) and "DÉFAITES" (red badge)
  with matching totals, three method rows each with a percentage and a filled
  bar, and — only if that fighter has a draw — a small "`W-L · N nul(s)`" line
  above the columns.
- No console errors in the browser.

- [ ] **Step 4: Visual smoke check on mobile (web target)**

Start the mobile web preview (`cd mobile && npx expo start --web`, or via the
`mobile-web` launch config), navigate to the same fighter's screen, and confirm
the same card renders correctly at a phone-width viewport (no column overlap
or clipped text).

- [ ] **Step 5: Final commit (if smoke checks required any fixes)**

If steps 3–4 required code changes, commit them now with a message describing
the fix. If no changes were needed, there is nothing to commit — the feature
branch is ready to hand off (PR / merge decision is a separate step, not part
of this plan).
