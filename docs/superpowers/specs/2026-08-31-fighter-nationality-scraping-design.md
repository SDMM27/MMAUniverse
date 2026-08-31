# Fighter nationality scraping + backfill — design

## Goal

The nationality flags built in the prior "Fighter Nationality Flags" feature
(`docs/superpowers/specs/2026-08-31-fighter-flags-design.md`) render nothing
anywhere in the app, because the `fighters.nationality` column — while it
exists in the schema — has never actually been populated by any scraper.
Verified directly against the live database: **8738 fighters, 0 with a
non-null `nationality`.** This design closes that gap: scrape the data going
forward, and backfill it for every fighter already in the database.

## Where the data lives on Sherdog

Confirmed by inspecting a live fighter page (`sherdog.com/fighter/Douglas-Lima-17236`)
with the browser: the page's nationality flag is

```html
<div class="fighter-nationality">
  <img class="big_flag" src="/img/flags/big/br.png" alt="Country">
</div>
```

The ISO 3166-1 alpha-2 code is embedded directly in the flag image's
filename — no country-name-to-code mapping needed, and it's the exact format
`countryCodeToFlag` (in `data/lib/flag-utils.ts`) already expects. The page
also shows the country as text (`<strong itemprop="nationality">Brazil</strong>`
inside `.item.birthplace`), but the flag image's filename is preferred: it's
already the exact code we need, with no name-parsing/locale ambiguity.

## Existing pipeline (being extended, not duplicated)

`data/scrapers/parse.ts` (`parseFighterDetails`) extracts fields from a
fetched fighter page → `data/scrapers/sherdog.ts` assembles them into
`data/scraped/{org}.json` (typed as `ScrapedFighter` in
`data/scrapers/shared/types.ts`) → separate `sync-*.ts` scripts push that
JSON into the live Neon database → `.github/workflows/daily-sync.yml` runs
`sync-fighter-history.ts` against production every day at 09:00 UTC (confirmed:
this is the same database — single Neon project, no separate dev/prod split
for this app). This design threads `nationality` through every stage of that
same pipeline rather than inventing a parallel one.

## Code changes

1. **`data/scrapers/parse.ts`** — `parseFighterDetails` gains a `nationality:
   string | null` field on `ParsedFighterDetails`, extracted via
   `$('.fighter-nationality img.big_flag').first().attr('src')`, parsing the
   two-letter code out of the trailing `/{cc}.png` with a regex and
   uppercasing it. `null` when the element is missing (some fighters have no
   flag on Sherdog) or the filename doesn't match the expected shape.

2. **`data/scrapers/shared/types.ts`** — `ScrapedFighter` gains
   `nationality?: string | null`, following the same "optional, absent on
   any fighter scraped before this field existed" pattern already documented
   there for `sherdog_url` and `fight_history`.

3. **`data/scrapers/sherdog.ts`** — the fighter object pushed onto
   `progress.data.fighters` includes `nationality: details.nationality`, so
   every future normal scrape/rescrape (`npm run scrape:*`,
   `rescrape-upcoming.ts`) captures it automatically going forward.

4. **`data/scrapers/sync-fighter-history.ts`** — the existing per-fighter
   `UPDATE fighters SET sherdog_url = ...` gains `nationality =
   ${fighter.nationality || null}`. This script already runs daily in
   production (`daily-sync.yml`), so no new workflow step is needed — once a
   fighter's JSON has a `nationality`, the next daily run pushes it live.

5. **Consistency fixes at the other three fighter-write sites** — same
   one-column addition to their existing `INSERT`/`UPDATE` statements, so a
   future full reseed or an additional-org sync doesn't silently drop
   `nationality` the way it silently dropped it everywhere until now:
   - `data/scrapers/seed-additional-orgs.ts`
   - `data/scrapers/sync-upcoming-to-db.ts`
   - `app/seed/route.ts`

## Backfill for the 8738 already-scraped fighters

New script, **`data/scrapers/backfill-fighter-nationality.ts`**, modeled
directly on the existing `backfill-fighter-history.ts` (same checkpoint/resume
mechanism via a `data/scraped/.cache/*-progress.json` file, same
`fetchAndLoad` throttled fetcher, same "recover each fighter's Sherdog URL
from the `fighterUrlToName` cache, dedupe by URL across orgs, write results
back into each org's JSON" shape) but scoped to only fetching and recording
`nationality` — it doesn't touch fight history at all, so it can't get
confused with or clobber the unrelated progress checkpoint
`backfill-fighter-history.ts` already completed. Its own checkpoint file
(`fighter-nationality-backfill-progress.json`) makes it safe to interrupt and
resume.

**Scale, confirmed against the live database:** 6185 distinct non-null
`sherdog_url` values (fighters sharing a real-world identity across multiple
org rows are deduped by URL, same as the history backfill). At the existing
1.5s-per-request throttle in `fetchAndLoad`, that's roughly **2.5–3 hours**
of runtime. 1743 fighters have no `sherdog_url` at all yet (never
individually backfilled) and are out of reach of this URL-based approach —
same pre-existing limitation `backfill-fighter-history.ts` already has for
fight history, not something this design introduces or needs to solve.

After the backfill script finishes writing `nationality` into
`data/scraped/*.json`, running `sync-fighter-history.ts` once (manually,
rather than waiting for tomorrow's cron) pushes the results into the live
database immediately.

## Out of scope

- No change to `countryCodeToFlag` or any UI component — the previously
  completed flag-rendering work (fighter cards, fight rows, fighter pages,
  the home hero, mobile) already correctly renders a flag wherever
  `nationality` is non-null; it simply had no data to work with until now.
- No attempt to backfill the 1743 fighters with no `sherdog_url` — that
  requires solving fighter-identity matching without a Sherdog URL, which is
  a materially different (and already-known, pre-existing) problem outside
  this design's scope.
- No new GitHub Actions workflow step — `sync-fighter-history.ts` already
  runs daily in production; this design rides that existing schedule.
