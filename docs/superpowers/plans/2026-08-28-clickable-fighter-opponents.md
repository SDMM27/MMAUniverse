# Clickable Fighter Opponents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every opponent listed on a fighter's page (`/fighters/[id]`) clickable — linking to the opponent's internal fighter page when known, falling back to their Sherdog page, and to plain text only when neither is available.

**Architecture:** `fetchFighterFightHistory` (in `data/lib/data.ts`) already unions two sources into one `FightHistoryEntry[]`: upcoming bouts (joined from our own `fights`/`fighters` tables) and completed history (scraped into `fighter_fight_history`). We add an `opponent_id` field to `FightHistoryEntry`, populate it from the existing `fighters` join for upcoming bouts, and resolve it for history rows via a correlated subquery matching the already-stored `fighter_fight_history.opponent_sherdog_url` against `fighters.sherdog_url` — the same shape of fix already applied to `event_id` in commit `785630d`. `FighterHistoryList` then renders the opponent name as a `Link`/`<a>`/plain text based on `opponent_id` / `opponent_sherdog_url`, mirroring its existing "Événement" column logic exactly.

**Tech Stack:** Next.js App Router, TypeScript, `@vercel/postgres`-style tagged-template `sql` (see `data/lib/db.ts`), Tailwind CSS. Node's built-in test runner (`tsx --test`) is the only test infra in this repo, wired to pure functions under `data/**/*.test.ts` — there is no DB-integration or component-test harness, so this plan follows the same precedent as commit `785630d` and verifies the SQL change against the live DB manually, and the component change via the browser preview (`read_page`/screenshot), rather than introducing new test infrastructure out of scope for this fix.

---

### Task 1: Add `opponent_id` to `FightHistoryEntry`

**Files:**
- Modify: [data/lib/definitions.ts:63-86](data/lib/definitions.ts)

- [ ] **Step 1: Add the field and extend the doc comment**

Replace:

```typescript
// Merges two sources — see fetchFighterFightHistory in data/lib/data.ts:
// upcoming (not-yet-fought) bouts still come from our own `fights`/`events`
// tables (event_id set, event_sherdog_url null); every completed fight comes
// from `fighter_fight_history`, scraped straight off the fighter's own
// Sherdog page (event_sherdog_url always set — Sherdog is the source of
// truth there, not necessarily one of the orgs/events we track). event_id is
// only populated when that row's event_name also matches one of our own
// `events` rows (e.g. it was synced in while upcoming and has since
// happened) — the UI prefers that internal link and falls back to
// event_sherdog_url otherwise.
export type FightHistoryEntry = {
  id: string;
  event_id: number | null;
  event_name: string;
  event_date: string;
  event_sherdog_url: string | null;
  opponent_name: string | null;
  opponent_image_url: string | null;
  result: 'win' | 'loss' | 'draw' | 'nc' | 'upcoming';
  method: string | null;
  referee: string | null;
  round: number | null;
  time: string | null;
};
```

with:

```typescript
// Merges two sources — see fetchFighterFightHistory in data/lib/data.ts:
// upcoming (not-yet-fought) bouts still come from our own `fights`/`events`
// tables (event_id set, event_sherdog_url null); every completed fight comes
// from `fighter_fight_history`, scraped straight off the fighter's own
// Sherdog page (event_sherdog_url always set — Sherdog is the source of
// truth there, not necessarily one of the orgs/events we track). event_id is
// only populated when that row's event_name also matches one of our own
// `events` rows (e.g. it was synced in while upcoming and has since
// happened) — the UI prefers that internal link and falls back to
// event_sherdog_url otherwise.
//
// opponent_id follows the same pattern: for upcoming bouts it's the opposing
// fighter's own id, taken directly from the `fighters` join (the opponent is
// always one of our tracked fighters there). For history rows it's resolved
// by matching this row's opponent_sherdog_url against `fighters.sherdog_url`
// — a stronger key than opponent name, which can collide between two
// fighters who share a name. It's null when no internal fighter matches;
// the UI then falls back to opponent_sherdog_url, and to plain text if
// neither is set.
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
  result: 'win' | 'loss' | 'draw' | 'nc' | 'upcoming';
  method: string | null;
  referee: string | null;
  round: number | null;
  time: string | null;
};
```

Note: `opponent_sherdog_url` is added alongside `opponent_id` so the component can fall back to it — it's the same fallback role `event_sherdog_url` already plays next to `event_id`.

- [ ] **Step 2: Typecheck**

Run:

```bash
npx tsc --noEmit
```

Expected: fails — `data/lib/data.ts`'s `FightHistoryEntry` object literals are now missing `opponent_id`/`opponent_sherdog_url`. That's expected; Task 2 fixes it. Confirm the errors are only in `data/lib/data.ts` (both `upcomingEntries` and `historyEntries` literals) and not elsewhere.

- [ ] **Step 3: Commit**

```bash
git add data/lib/definitions.ts
git commit -m "feat(types): add opponent_id/opponent_sherdog_url to FightHistoryEntry"
```

---

### Task 2: Resolve `opponent_id` in `fetchFighterFightHistory`

**Files:**
- Modify: [data/lib/data.ts:279-369](data/lib/data.ts)

- [ ] **Step 1: Select `opponent.id` for upcoming bouts**

Replace:

```typescript
    const upcoming = await sql<{
      id: number;
      event_id: number;
      event_name: string;
      event_date: string;
      opponent_name: string | null;
      opponent_image_url: string | null;
    }>`
      SELECT
        f.id, f.event_id,
        e.name AS event_name, e.date AS event_date,
        opponent.name AS opponent_name, opponent.image_url AS opponent_image_url
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

with:

```typescript
    const upcoming = await sql<{
      id: number;
      event_id: number;
      event_name: string;
      event_date: string;
      opponent_id: number | null;
      opponent_name: string | null;
      opponent_image_url: string | null;
    }>`
      SELECT
        f.id, f.event_id,
        e.name AS event_name, e.date AS event_date,
        opponent.id AS opponent_id, opponent.name AS opponent_name, opponent.image_url AS opponent_image_url
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

- [ ] **Step 2: Resolve `opponent_id` for history rows and select `opponent_sherdog_url`**

Replace:

```typescript
    const history = await sql<{
      id: number;
      opponent_name: string;
      event_name: string;
      event_date: string | null;
      event_sherdog_url: string | null;
      event_id: number | null;
      result: string;
      method: string | null;
      referee: string | null;
      round: number | null;
      time: string | null;
    }>`
      SELECT
        fhh.id, fhh.opponent_name, fhh.event_name, fhh.event_date, fhh.event_sherdog_url,
        fhh.result, fhh.method, fhh.referee, fhh.round, fhh.time,
        (
          SELECT e.id FROM events e WHERE e.name = fhh.event_name ORDER BY e.id ASC LIMIT 1
        ) AS event_id
      FROM fighter_fight_history fhh
      WHERE fhh.fighter_id = ANY(${fighterIds})
      ORDER BY fhh.event_date DESC NULLS LAST
    `;
```

with:

```typescript
    const history = await sql<{
      id: number;
      opponent_name: string;
      opponent_sherdog_url: string | null;
      event_name: string;
      event_date: string | null;
      event_sherdog_url: string | null;
      event_id: number | null;
      opponent_id: number | null;
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
        ) AS opponent_id
      FROM fighter_fight_history fhh
      WHERE fhh.fighter_id = ANY(${fighterIds})
      ORDER BY fhh.event_date DESC NULLS LAST
    `;
```

- [ ] **Step 3: Map the new fields into both entry lists**

Replace:

```typescript
    const upcomingEntries: FightHistoryEntry[] = upcoming.rows.map((row) => ({
      id: `upcoming-${row.id}`,
      event_id: row.event_id,
      event_name: row.event_name,
      event_date: row.event_date,
      event_sherdog_url: null,
      opponent_name: row.opponent_name,
      opponent_image_url: row.opponent_image_url,
      result: 'upcoming',
      method: null,
      referee: null,
      round: null,
      time: null,
    }));

    const historyEntries: FightHistoryEntry[] = dedupedHistory.map((row) => ({
      id: `history-${row.id}`,
      // Matched by name against our own `events` table (same natural key
      // getEventIdByName/dedupe-seed-duplicates.ts use elsewhere) — a
      // fighter_fight_history row for an event we already track (e.g. it was
      // synced in while upcoming and has since happened) should still link to
      // our internal event page, not fall through to Sherdog.
      event_id: row.event_id,
      event_name: row.event_name,
      event_date: row.event_date ?? '',
      event_sherdog_url: row.event_sherdog_url,
      opponent_name: row.opponent_name,
      opponent_image_url: null,
      result: (row.result as FightHistoryEntry['result']) ?? 'draw',
      method: row.method,
      referee: row.referee,
      round: row.round,
      time: row.time,
    }));
```

with:

```typescript
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
      result: 'upcoming',
      method: null,
      referee: null,
      round: null,
      time: null,
    }));

    const historyEntries: FightHistoryEntry[] = dedupedHistory.map((row) => ({
      id: `history-${row.id}`,
      // Matched by name against our own `events` table (same natural key
      // getEventIdByName/dedupe-seed-duplicates.ts use elsewhere) — a
      // fighter_fight_history row for an event we already track (e.g. it was
      // synced in while upcoming and has since happened) should still link to
      // our internal event page, not fall through to Sherdog.
      event_id: row.event_id,
      event_name: row.event_name,
      event_date: row.event_date ?? '',
      event_sherdog_url: row.event_sherdog_url,
      // Matched by opponent_sherdog_url against fighters.sherdog_url — see
      // the FightHistoryEntry doc comment in definitions.ts for why this is
      // preferred over matching on opponent_name.
      opponent_id: row.opponent_id,
      opponent_name: row.opponent_name,
      opponent_image_url: null,
      opponent_sherdog_url: row.opponent_sherdog_url,
      result: (row.result as FightHistoryEntry['result']) ?? 'draw',
      method: row.method,
      referee: row.referee,
      round: row.round,
      time: row.time,
    }));
```

- [ ] **Step 4: Typecheck**

Run:

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Verify against the live DB**

Run (adjust the id to a fighter with completed fights against a tracked opponent — e.g. a recent UFC champion):

```bash
npx tsx -e "
import { fetchFighterFightHistory } from './data/lib/data';
fetchFighterFightHistory('<a-fighter-id-from-your-db>').then((fights) => {
  console.table(fights.map((f) => ({ opponent_name: f.opponent_name, opponent_id: f.opponent_id, opponent_sherdog_url: f.opponent_sherdog_url })));
});
"
```

Expected: at least one history row where the opponent is also a tracked fighter resolves a non-null `opponent_id`; rows for untracked opponents show `opponent_id: null` with `opponent_sherdog_url` still populated; every `upcoming` row has a non-null `opponent_id`.

- [ ] **Step 6: Commit**

```bash
git add data/lib/data.ts
git commit -m "feat(web): resolve opponent_id in fetchFighterFightHistory"
```

---

### Task 3: Make opponent names clickable in `FighterHistoryList`

**Files:**
- Modify: [components/ui/fighters/fighter-history-list.tsx](components/ui/fighters/fighter-history-list.tsx)

- [ ] **Step 1: Link the opponent in the "upcoming" card**

The whole card is currently one `<Link href={`/events/${fight.event_id}`}>` (the entire row navigates to the event). Nesting a second `<Link>` for the opponent inside it would produce an `<a>` inside an `<a>` — invalid HTML, and browsers only honor the innermost one, so clicking the opponent name would still navigate to the event instead of the fighter. So this step also turns the outer `Link` into a plain `div`, moving the event navigation onto the metadata line and the "À venir" badge instead.

Replace the entire `<li>...</li>` block (currently lines 29-42):

```tsx
            <li key={fight.id}>
              <Link
                href={`/events/${fight.event_id}`}
                className="flex items-center justify-between rounded-lg border border-accent bg-base-card p-3 hover:border-accent"
              >
                <div>
                  <p className="text-sm text-ink-primary">vs {fight.opponent_name ?? 'Adversaire inconnu'}</p>
                  <p className="text-xs text-ink-secondary">
                    {fight.event_name} · {fight.event_date}
                  </p>
                </div>
                <span className="font-display text-xs uppercase tracking-wide text-accent">À venir</span>
              </Link>
            </li>
```

with:

```tsx
            <li key={fight.id}>
              <div className="flex items-center justify-between rounded-lg border border-accent bg-base-card p-3 hover:border-accent">
                <div>
                  <p className="text-sm text-ink-primary">
                    vs{' '}
                    {fight.opponent_id ? (
                      <Link
                        href={`/fighters/${fight.opponent_id}`}
                        className="text-ink-primary underline-offset-2 hover:underline"
                      >
                        {fight.opponent_name ?? 'Adversaire inconnu'}
                      </Link>
                    ) : (
                      (fight.opponent_name ?? 'Adversaire inconnu')
                    )}
                  </p>
                  <Link href={`/events/${fight.event_id}`} className="text-xs text-ink-secondary hover:underline">
                    {fight.event_name} · {fight.event_date}
                  </Link>
                </div>
                <Link
                  href={`/events/${fight.event_id}`}
                  className="font-display text-xs uppercase tracking-wide text-accent hover:underline"
                >
                  À venir
                </Link>
              </div>
            </li>
```

- [ ] **Step 2: Link the opponent in the history table**

Replace:

```tsx
                  <td className="p-3 align-top text-ink-primary">{fight.opponent_name ?? 'Adversaire inconnu'}</td>
```

with:

```tsx
                  <td className="p-3 align-top text-ink-primary">
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
                  </td>
```

- [ ] **Step 3: Typecheck**

Run:

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Lint**

Run:

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 5: Verify in the browser**

Start the dev server preview and open a fighter page that has both upcoming and historical fights (e.g. one with a scheduled bout and a completed career), for example `/fighters/<id-with-fights>`:

- Confirm the upcoming card's opponent name is a distinct link from the event link (hovering shows two separate underlines/targets), and that clicking it navigates to `/fighters/{opponent_id}`, not to the event.
- Confirm at least one history row's opponent is a blue/accent link. Click one that resolves to a tracked fighter and confirm it lands on that fighter's own page (not the current one).
- If the fixture data has an opponent with no internal match but a Sherdog URL, confirm it opens Sherdog in a new tab.
- Confirm an opponent with neither (if any exist in the data) still renders as plain text, unchanged from before.

- [ ] **Step 6: Commit**

```bash
git add components/ui/fighters/fighter-history-list.tsx
git commit -m "feat(web): make fighter opponents clickable on the fighter detail page"
```

---

### Task 4: Update the plan's originating spec cross-reference (docs hygiene)

**Files:**
- Modify: [docs/superpowers/specs/2026-08-28-clickable-fighter-opponents-design.md](docs/superpowers/specs/2026-08-28-clickable-fighter-opponents-design.md)

- [ ] **Step 1: Add an implementation-status note**

Replace the file's final line:

```markdown
- Rendu de la fiche combattant : vérifier visuellement (ou via `read_page`) que les noms d'adversaires sont bien des liens, internes ou externes selon le cas.
```

with:

```markdown
- Rendu de la fiche combattant : vérifier visuellement (ou via `read_page`) que les noms d'adversaires sont bien des liens, internes ou externes selon le cas.

## Statut

Implémenté — voir `docs/superpowers/plans/2026-08-28-clickable-fighter-opponents.md`.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-08-28-clickable-fighter-opponents-design.md
git commit -m "docs: mark clickable-fighter-opponents spec as implemented"
```
