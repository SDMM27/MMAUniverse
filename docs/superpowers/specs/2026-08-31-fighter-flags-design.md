# Fighter nationality flags — design

## Goal

Show each fighter's nationality flag (emoji, derived from `fighters.nationality`,
an ISO 3166-1 alpha-2 code) everywhere a fighter is displayed, on both the web
app and the mobile app — fighter pages, fight cards/rows, event pages, and the
fighter list. Requested by the product owner: "j'aimerais ajouter les
drapeaux des combattants dès que c'est possible... sur les pages combattants,
mais aussi sur les fights, les events etc."

## Existing building block

`countryCodeToFlag(code: string | null): string | null` already exists in
`data/lib/flag-utils.ts` (web) and `mobile/lib/flag-utils.ts` (mobile, a
verbatim copy), fully tested in `data/lib/flag-utils.test.ts`. It converts an
ISO alpha-2 code to its regional-indicator flag emoji, and returns `null` for
missing/malformed input so callers can skip rendering entirely. It is already
used in `components/ui/fights/fight-card.tsx` and
`mobile/components/cards.tsx`'s `FightCard`. No changes needed to this
utility — this project is entirely about calling it from the places that
don't yet, and, where the underlying data isn't fetched yet, extending the
SQL to fetch it.

No DB schema change: `fighters.nationality` already exists and is already
populated by the scrapers.

## Data layer changes (`data/lib/data.ts`, shared by web and the mobile API routes)

Two fetchers build fighter-shaped objects without carrying `nationality`
through; both need the column added to their SQL and their row-mapping.

1. **`fetchRecentFinishedFights`** (powers the home page's "Derniers
   résultats" section via `FightResultRow` → `FightRow`): the `f1_*`/`f2_*`
   column list and the `fighter1`/`fighter2` mapping omit `nationality`
   (unlike the near-identical `fetchFightsByEvent`, which already selects
   it). Add `f1.nationality AS f1_nationality`, `f2.nationality AS
   f2_nationality` to the query and to the mapped `fighter1`/`fighter2`
   objects.

2. **`fetchFighterFightHistory`** (powers the fighter page's "Historique"
   table and its mobile equivalent): neither of its two queries carries the
   opponent's nationality.
   - The `upcoming` query already `LEFT JOIN`s `fighters opponent`for the
     bout's opponent — add `opponent.nationality AS opponent_nationality` to
     its SELECT list.
   - The `history` query resolves `opponent_id` via a correlated subquery
     matching `fhh.opponent_sherdog_url` against `fighters.sherdog_url`
     (`fighter_fight_history` rows don't have a direct FK to `fighters`).
     Add a second correlated subquery of the same shape, selecting
     `nationality` instead of `id`, aliased `opponent_nationality`. When no
     internal fighter matches (subquery returns no row), it's `NULL` — same
     graceful-miss behavior the existing `opponent_id` subquery already has,
     and `countryCodeToFlag(null)` already renders nothing for it.

   Both `upcomingEntries` and `historyEntries` row-mapping gain
   `opponent_nationality: row.opponent_nationality`.

### Type changes

- `data/lib/definitions.ts`: add `opponent_nationality: string | null` to
  `FightHistoryEntry`.
- `mobile/lib/types.ts`: add the same field to its mirrored
  `FightHistoryEntry` (this type is hand-kept in sync with the web one per
  its own doc comment).

The mobile API routes (`app/api/mobile/**/route.ts`) call straight into
`data/lib/data.ts`, so both data-layer fixes above reach mobile for free —
no route changes needed.

## Web component changes

All additions follow the existing `FightCard` pattern: render the flag next
to the fighter's photo/name, `aria-hidden="true"` (the fighter's name already
carries the accessible information — the flag is decorative reinforcement,
same as today's `FightCard`), and render nothing when `countryCodeToFlag`
returns `null`.

- **`components/ui/fighters/fighter-card.tsx`** (grid card, `/fighters`
  listing and anywhere else it's reused): add the flag next to the fighter
  name.
- **`components/ui/fights/fight-row.tsx`** (`FighterSide`): add the flag next
  to each fighter's name. This is the highest-leverage single change — it's
  reused by the home page's "Combats à venir" and "Derniers résultats"
  (via `FightResultRow`) and the event page's undercard list.
- **`app/fighters/[slug]/page.tsx`**: the header currently renders
  `fighter.nationality` as raw text (e.g. "FR") in the metadata row next to
  the ranking badge and record. Replace that raw-text span with the flag
  emoji (kept in the same metadata row, same position) — consistent with
  every other surface showing a flag instead of a text code, and more
  legible than a bare ISO code.
- **`components/ui/fighters/fighter-history-list.tsx`**: add the flag next
  to the opponent's name in the "Adversaire" column, using the new
  `opponent_nationality` field.
- **`components/ui/events/next-event-hero.tsx`**: the matchup visual has no
  text overlay on the fighter photos today (just the photos and a "VS"
  mark). Add a small flag badge in a corner of each fighter's photo panel
  (e.g. bottom-inside corner, semi-transparent backdrop for legibility over
  a photo) — same nationality data already passed in via the `fighter1`/
  `fighter2` props. Skipped entirely (both sides) when a fighter has no
  flag, same as everywhere else.

## Mobile component changes

Same pattern, React Native equivalents:

- **`mobile/components/cards.tsx`**:
  - `FighterCard` — add the flag next to the fighter name.
  - `FightRow` — add the flag next to each fighter's name.
- **`mobile/app/(tabs)/fighters/[id].tsx`**:
  - Header — this screen doesn't show nationality at all today; add the flag
    next to the fighter's name.
  - History `renderItem` — add the flag next to the opponent's name, using
    the new `opponent_nationality` field.

## Out of scope

- No changes to `countryCodeToFlag` itself or its tests — it already handles
  every case callers need (null, lowercase, malformed).
- No DB/schema/scraper changes — `nationality` is already populated.
- No new automated tests: the SQL fetchers in `data/lib/data.ts` have no
  existing unit tests (they depend on a live DB) and this change doesn't
  alter that pattern; `flag-utils.test.ts` already fully covers the one pure
  function this feature relies on.
