# Fighter Nationality Scraping + Backfill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `fighters.nationality` actually get populated — by scraping it from Sherdog going forward, and backfilling it for the 8738 fighters already in the database — so the flag-rendering UI built in the prior "Fighter Nationality Flags" plan has real data to show.

**Architecture:** Sherdog encodes a fighter's nationality as a flag image whose filename IS the ISO 3166-1 alpha-2 code (`/img/flags/big/br.png` → `BR`) — no country-name mapping needed. This plan threads a `nationality` field through the existing scrape → JSON → DB-sync pipeline (`parse.ts` → `sherdog.ts` → `data/scraped/*.json` → `sync-*.ts` scripts → Neon), the same pipeline `sherdog_url`/`fight_history` already travel through, rather than building a new one. A new one-off backfill script (modeled directly on the existing `backfill-fighter-history.ts`) re-fetches each already-known fighter's page once to fill in the field for fighters scraped before it existed.

**Tech Stack:** `cheerio` (HTML parsing), the project's existing `tsx --test` suite (`data/scrapers/parse.test.ts`), `@neondatabase/serverless` for the DB-writing scripts.

**Design doc:** `docs/superpowers/specs/2026-08-31-fighter-nationality-scraping-design.md`

**Verification throughout:** `npx tsc --noEmit` from the repo root (covers every file this plan touches — `data/scrapers/**` and `app/seed/route.ts` are both included by the root `tsconfig.json`) plus `npm test` for the one file with real unit tests (`data/scrapers/parse.test.ts`).

---

### Task 1: `parse.ts` — extract nationality from the flag image (TDD)

**Files:**
- Modify: `data/scrapers/__fixtures__/fighter-page.html`
- Modify: `data/scrapers/parse.ts`
- Test: `data/scrapers/parse.test.ts`

- [ ] **Step 1: Add the flag markup to the fixture**

In `data/scrapers/__fixtures__/fighter-page.html`, find this block (near the top, inside `.fighter-title > .fighter-line1`):

```html
      <div class="fighter-title">
        <div class="fighter-line1">
          <h1 itemprop="name"><span class="fn">Douglas Lima</span></h1>
        </div>
      </div>
```

Replace it with (this mirrors the real Sherdog DOM structure, confirmed against a live fighter page — `.fighter-flag-social > .fighter-nationality > img.big_flag`, sibling of the `<h1>` inside `.fighter-line1`):

```html
      <div class="fighter-title">
        <div class="fighter-line1">
          <h1 itemprop="name"><span class="fn">Douglas Lima</span></h1>
          <div class="fighter-flag-social">
            <div class="fighter-nationality">
              <img class="big_flag" src="/img/flags/big/br.png" alt="Country" />
            </div>
          </div>
        </div>
      </div>
```

- [ ] **Step 2: Write the failing tests**

In `data/scrapers/parse.test.ts`, right after the existing test `'parseFighterDetails extracts name, weight class, image and win/loss counts'` (ends around line 159), add:

```ts
test('parseFighterDetails extracts nationality from the flag image filename', () => {
  const $ = loadFixture('fighter-page.html');
  const details = parseFighterDetails($);

  assert.equal(details.nationality, 'BR');
});

test('parseFighterDetails returns null nationality when the fighter has no flag on Sherdog', () => {
  const $ = cheerio.load(
    '<html><body><div class="fighter-info"><h1 itemprop="name"><span class="fn">No Flag Fighter</span></h1></div></body></html>',
  );
  const details = parseFighterDetails($);

  assert.equal(details.nationality, null);
});
```

(`cheerio` is already imported at the top of this file for `loadFixture`, no new import needed.)

- [ ] **Step 3: Run the tests and confirm they fail**

Run: `npm test`
Expected: FAIL — `details.nationality` is `undefined` (the field doesn't exist yet on `ParsedFighterDetails`/the return value of `parseFighterDetails`), so `assert.equal(details.nationality, 'BR')` fails.

- [ ] **Step 4: Implement the extraction**

In `data/scrapers/parse.ts`, add `nationality: string | null;` to the `ParsedFighterDetails` interface, right after `weightClass`:

```ts
export interface ParsedFighterDetails {
  name: string;
  imageUrl: string;
  weightClass: string;
  nationality: string | null;
  wins: number;
  losses: number;
  draws: number;
  fightHistory: ParsedFighterHistoryEntry[];
}
```

Then, right before the `parseFighterDetails` function (currently starting at line 284), add a helper:

```ts
// Sherdog encodes a fighter's nationality as a flag image whose filename IS the ISO 3166-1
// alpha-2 code itself (e.g. /img/flags/big/br.png for Brazil) — no country-name-to-code
// mapping needed. Returns null when the fighter has no flag on Sherdog, or the filename
// doesn't match the expected shape.
function parseNationality($: CheerioAPI): string | null {
  const flagSrc = $('.fighter-nationality img.big_flag').first().attr('src');
  if (!flagSrc) return null;
  const match = flagSrc.match(/\/([a-z]{2})\.png$/i);
  return match ? match[1].toUpperCase() : null;
}
```

Then update `parseFighterDetails` itself:

```ts
export function parseFighterDetails($: CheerioAPI): ParsedFighterDetails {
  const name = $('h1[itemprop="name"] span.fn').first().text().trim();
  const imageSrc = $('.fighter-info img[itemprop="image"]').first().attr('src') ?? '';
  const imageUrl = imageSrc ? absoluteUrl(imageSrc, 'https://www.sherdog.com') : '';
  const weightClass = $('.association-class a[href*="weightclass="]').first().text().trim();
  const nationality = parseNationality($);
  const wins = parseInt($('.winloses.win span').eq(1).text().trim(), 10) || 0;
  const losses = parseInt($('.winloses.lose span').eq(1).text().trim(), 10) || 0;
  const drawsText = $('.winloses.draw span').eq(1).text().trim();
  const draws = drawsText ? parseInt(drawsText, 10) || 0 : 0;
  const fightHistory = parseFighterFightHistory($);

  return { name, imageUrl, weightClass, nationality, wins, losses, draws, fightHistory };
}
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `npm test`
Expected: PASS — all tests green, including the two new ones.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add data/scrapers/__fixtures__/fighter-page.html data/scrapers/parse.ts data/scrapers/parse.test.ts
git commit -m "feat(scrape): extract fighter nationality from Sherdog's flag image"
```

---

### Task 2: `ScrapedFighter` type gains `nationality`

**Files:**
- Modify: `data/scrapers/shared/types.ts`

- [ ] **Step 1: Add the field**

In `data/scrapers/shared/types.ts`, add `nationality` to `ScrapedFighter`, right after `ranking`:

```ts
export interface ScrapedFighter {
  name: string;
  image_url: string;
  weight_class: string;
  record: string; // 'W-L-D'
  ranking: number;
  // ISO 3166-1 alpha-2 code (e.g. 'BR'), or null when Sherdog shows no flag for this
  // fighter. Absent (not just null) on any fighter scraped before this field was
  // introduced — same "absent until rescraped" pattern as sherdog_url/fight_history below.
  nationality?: string | null;
  // Absent on any fighter scraped before this field was introduced (same
  // "absent until rescraped" pattern as ScrapedEvent.start_time above).
  sherdog_url?: string;
  // The fighter's complete career record as scraped straight from their own
  // Sherdog page's "Fight History" table — every organization Sherdog knows
  // about, not just the ones we track. This is what backfills history for a
  // fighter who just transferred into a tracked org from one we've never
  // scraped (e.g. a KSW veteran signed by the UFC).
  fight_history?: ScrapedFightHistoryEntry[];
}
```

Nothing else in the file changes.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add data/scrapers/shared/types.ts
git commit -m "feat(scrape): add nationality to the ScrapedFighter type"
```

---

### Task 3: `sherdog.ts` — carry nationality into every future scrape

**Files:**
- Modify: `data/scrapers/sherdog.ts`

- [ ] **Step 1: Add `nationality` to the pushed fighter object**

In `data/scrapers/sherdog.ts`, find the block that pushes a fresh fighter (currently around line 102):

```ts
    progress.data.fighters.push({
      name: details.name || fallbackName,
      image_url: details.imageUrl,
      weight_class: details.weightClass,
      record: `${details.wins}-${details.losses}-${details.draws}`,
      ranking: 0,
      sherdog_url: fighterUrl,
      fight_history: toScrapedFightHistory(details.fightHistory),
    });
```

Add one line:

```ts
    progress.data.fighters.push({
      name: details.name || fallbackName,
      image_url: details.imageUrl,
      weight_class: details.weightClass,
      nationality: details.nationality,
      record: `${details.wins}-${details.losses}-${details.draws}`,
      ranking: 0,
      sherdog_url: fighterUrl,
      fight_history: toScrapedFightHistory(details.fightHistory),
    });
```

Nothing else in the file changes.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add data/scrapers/sherdog.ts
git commit -m "feat(scrape): carry nationality through the main scrape pipeline"
```

---

### Task 4: `sync-fighter-history.ts` — push nationality to Neon

**Files:**
- Modify: `data/scrapers/sync-fighter-history.ts`

This script already runs daily in production (`.github/workflows/daily-sync.yml`) — this task doesn't add any new workflow step.

- [ ] **Step 1: Ensure the column exists**

In `data/scrapers/sync-fighter-history.ts`, inside `ensureSchema()`, add a line right after the existing `sherdog_url` column-ensure (the column already exists in production via `app/seed/route.ts`'s migration, but this makes the script self-sufficient regardless of whether `/seed` has ever run against a given database):

```ts
async function ensureSchema() {
  await sql`ALTER TABLE fighters ADD COLUMN IF NOT EXISTS sherdog_url VARCHAR(500);`;
  await sql`ALTER TABLE fighters ADD COLUMN IF NOT EXISTS nationality VARCHAR(2);`;
  await sql`
    CREATE TABLE IF NOT EXISTS fighter_fight_history (
```

(the rest of `ensureSchema()`'s `CREATE TABLE IF NOT EXISTS fighter_fight_history (...)` block stays exactly as-is below that.)

- [ ] **Step 2: Push nationality in the per-fighter UPDATE**

Find this line (currently around line 122):

```ts
      await sql`UPDATE fighters SET sherdog_url = ${fighter.sherdog_url} WHERE id = ${fighterId}`;
```

Replace it with:

```ts
      await sql`UPDATE fighters SET sherdog_url = ${fighter.sherdog_url}, nationality = ${fighter.nationality ?? null} WHERE id = ${fighterId}`;
```

Nothing else in the file changes.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add data/scrapers/sync-fighter-history.ts
git commit -m "feat(scrape): sync fighter nationality to the database"
```

---

### Task 5: Consistency — the other three fighter-write sites

**Files:**
- Modify: `data/scrapers/seed-additional-orgs.ts`
- Modify: `data/scrapers/sync-upcoming-to-db.ts`
- Modify: `app/seed/route.ts`

These three scripts also `INSERT`/`UPDATE` `fighters` rows but currently don't write `nationality` — not part of the daily production pipeline (so not required for the backfill in Task 7 to reach live data), but left inconsistent they'd silently drop `nationality` on a future full reseed or additional-org sync, the same class of gap this whole plan exists to fix. Closing all three now, in one task, since each is a one-line change to code already being read for this plan.

- [ ] **Step 1: `seed-additional-orgs.ts`**

Find (currently around line 78):

```ts
    await sql`
      INSERT INTO fighters (name, image_url, weight_class, organization_id, record, ranking)
      VALUES (${fighter.name}, ${fighter.image_url}, ${fighter.weight_class}, ${orgId}, ${fighter.record}, ${fighter.ranking});
    `;
```

Replace with:

```ts
    await sql`
      INSERT INTO fighters (name, image_url, weight_class, organization_id, record, ranking, nationality)
      VALUES (${fighter.name}, ${fighter.image_url}, ${fighter.weight_class}, ${orgId}, ${fighter.record}, ${fighter.ranking}, ${fighter.nationality ?? null});
    `;
```

- [ ] **Step 2: `sync-upcoming-to-db.ts`**

Find the `upsertFighter` function (currently around line 82):

```ts
async function upsertFighter(
  fighter: { name: string; image_url: string; weight_class: string; record: string; ranking: number },
  organizationId: number,
) {
  const existing = await sql`SELECT id FROM fighters WHERE name = ${fighter.name} ORDER BY id ASC`;
  if (existing.length > 0) {
    const id = existing[0].id;
    await sql`
      UPDATE fighters SET image_url = ${fighter.image_url}, weight_class = ${fighter.weight_class},
        record = ${fighter.record}, ranking = ${fighter.ranking}
      WHERE id = ${id}
    `;
    return id;
  }
  const inserted = await sql`
    INSERT INTO fighters (name, image_url, weight_class, organization_id, record, ranking)
    VALUES (${fighter.name}, ${fighter.image_url}, ${fighter.weight_class}, ${organizationId}, ${fighter.record}, ${fighter.ranking})
    RETURNING id
  `;
  return inserted[0].id;
}
```

Replace with:

```ts
async function upsertFighter(
  fighter: { name: string; image_url: string; weight_class: string; record: string; ranking: number; nationality?: string | null },
  organizationId: number,
) {
  const existing = await sql`SELECT id FROM fighters WHERE name = ${fighter.name} ORDER BY id ASC`;
  if (existing.length > 0) {
    const id = existing[0].id;
    await sql`
      UPDATE fighters SET image_url = ${fighter.image_url}, weight_class = ${fighter.weight_class},
        record = ${fighter.record}, ranking = ${fighter.ranking}, nationality = ${fighter.nationality ?? null}
      WHERE id = ${id}
    `;
    return id;
  }
  const inserted = await sql`
    INSERT INTO fighters (name, image_url, weight_class, organization_id, record, ranking, nationality)
    VALUES (${fighter.name}, ${fighter.image_url}, ${fighter.weight_class}, ${organizationId}, ${fighter.record}, ${fighter.ranking}, ${fighter.nationality ?? null})
    RETURNING id
  `;
  return inserted[0].id;
}
```

(The call site further down that passes a synthetic fallback fighter object — `{ name: fight.winner_name, image_url: '', weight_class: '', record: '', ranking: 0 }`, for a winner not otherwise in `dataset.fighters` — needs no change: `nationality` is now an optional property on the parameter type, so omitting it there still typechecks.)

- [ ] **Step 3: `app/seed/route.ts`**

Find, inside `seedFighters()` (currently around line 205):

```ts
      if (existing.rows[0]) {
        const result = await sql`
          UPDATE fighters SET image_url = ${fighter.image_url}, weight_class = ${fighter.weight_class}, record = ${fighter.record}, ranking = ${fighter.ranking}
          WHERE id = ${existing.rows[0].id};
        `;
        insertedFighters.push(result);
        continue;
      }
      const result = await sql`
        INSERT INTO fighters (name, image_url, weight_class, organization_id, record, ranking)
        VALUES (${fighter.name}, ${fighter.image_url}, ${fighter.weight_class}, ${dataset.organization_id}, ${fighter.record}, ${fighter.ranking});
      `;
```

Replace with:

```ts
      if (existing.rows[0]) {
        const result = await sql`
          UPDATE fighters SET image_url = ${fighter.image_url}, weight_class = ${fighter.weight_class}, record = ${fighter.record}, ranking = ${fighter.ranking}, nationality = ${fighter.nationality ?? null}
          WHERE id = ${existing.rows[0].id};
        `;
        insertedFighters.push(result);
        continue;
      }
      const result = await sql`
        INSERT INTO fighters (name, image_url, weight_class, organization_id, record, ranking, nationality)
        VALUES (${fighter.name}, ${fighter.image_url}, ${fighter.weight_class}, ${dataset.organization_id}, ${fighter.record}, ${fighter.ranking}, ${fighter.nationality ?? null});
      `;
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add data/scrapers/seed-additional-orgs.ts data/scrapers/sync-upcoming-to-db.ts app/seed/route.ts
git commit -m "feat(scrape): write nationality at every remaining fighter-upsert site"
```

---

### Task 6: New backfill script for already-scraped fighters

**Files:**
- Create: `data/scrapers/backfill-fighter-nationality.ts`

- [ ] **Step 1: Write the script**

Modeled directly on `data/scrapers/backfill-fighter-history.ts` (same checkpoint/resume mechanism, same throttled fetcher, same "one global sherdogUrl → name map across orgs, apply results back onto each org's JSON" shape), but scoped to only `nationality` — with its own progress file, so it can't collide with or be short-circuited by `backfill-fighter-history.ts`'s own (already-completed) checkpoint.

Create `data/scrapers/backfill-fighter-nationality.ts`:

```ts
// data/scrapers/backfill-fighter-nationality.ts
//
// One-off backfill: nationality was added to parseFighterDetails after most fighters were
// already scraped, so their data/scraped/{org}.json entries predate it and the normal scrape
// path won't refetch them (see the checkpoint in shared/checkpoint.ts and the
// knownFighterNames guard in rescrape-upcoming.ts). This script re-fetches each already-known
// fighter's own Sherdog page once, purely to fill in `nationality`, and writes the result back
// in place — modeled directly on backfill-fighter-history.ts, but scoped to this one field with
// its own progress checkpoint, so it can't collide with or be skipped by that script's own
// (already-completed) checkpoint.
//
// Recovers each fighter's Sherdog URL from data/scraped/.cache/{org}-progress.json's
// `fighterUrlToName` map, same as backfill-fighter-history.ts — orgs with no cache file (pfl,
// bellator: scraped before checkpointing existed) can't be targeted this way; re-run
// `npm run scrape:<org>` for those instead.
//
// A fighter appearing in multiple orgs is only fetched once: this builds one global
// sherdogUrl -> name map across every org first, then applies each result to every matching
// (by name) entry across every data/scraped/*.json file.
//
// Usage: npx tsx data/scrapers/backfill-fighter-nationality.ts [orgKey ...]
import fs from 'node:fs';
import path from 'node:path';
import { fetchAndLoad } from './shared/fetch-throttled';
import { parseFighterDetails } from './parse';
import { ORG_CONFIGS } from './orgs.config';
import type { ScrapedOrgData } from './shared/types';

const SCRAPED_DIR = path.resolve('data/scraped');
const CACHE_DIR = path.resolve('data/scraped/.cache');
const BACKFILL_PROGRESS_FILE = path.join(CACHE_DIR, 'fighter-nationality-backfill-progress.json');

interface BackfillResult {
  sherdogUrl: string;
  nationality: string | null;
}

function loadBackfillProgress(): Record<string, BackfillResult> {
  if (!fs.existsSync(BACKFILL_PROGRESS_FILE)) return {};
  return JSON.parse(fs.readFileSync(BACKFILL_PROGRESS_FILE, 'utf-8'));
}

function saveBackfillProgress(progress: Record<string, BackfillResult>): void {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(BACKFILL_PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

function loadDataset(orgKey: string): ScrapedOrgData | null {
  const file = path.join(SCRAPED_DIR, `${orgKey}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function loadFighterUrlToName(orgKey: string): Record<string, string> {
  const file = path.join(CACHE_DIR, `${orgKey}-progress.json`);
  if (!fs.existsSync(file)) return {};
  const progress = JSON.parse(fs.readFileSync(file, 'utf-8'));
  return progress.fighterUrlToName ?? {};
}

async function main() {
  const requestedKeys = process.argv.slice(2);
  const configs = requestedKeys.length > 0 ? ORG_CONFIGS.filter((c) => requestedKeys.includes(c.orgKey)) : ORG_CONFIGS;

  // One global map so a fighter shared across orgs (e.g. a champion who fought in both KSW
  // and UFC) is only fetched once.
  const urlToName = new Map<string, string>();
  const orgsWithoutCache: string[] = [];
  for (const config of configs) {
    const mapping = loadFighterUrlToName(config.orgKey);
    if (Object.keys(mapping).length === 0) {
      orgsWithoutCache.push(config.orgKey);
      continue;
    }
    for (const [url, name] of Object.entries(mapping)) {
      urlToName.set(url, name);
    }
  }

  if (orgsWithoutCache.length > 0) {
    console.log(
      `No progress cache for: ${orgsWithoutCache.join(', ')} — can't recover fighter URLs for them here. Re-run "npm run scrape:<org>" for each instead (empty checkpoint = full re-crawl, which picks up nationality automatically).`,
    );
  }

  const progress = loadBackfillProgress();
  const urls = Array.from(urlToName.keys());
  const alreadyDone = urls.filter((u) => progress[u]).length;
  console.log(`${urls.length} unique fighter URL(s) to backfill, ${alreadyDone} already done in a previous run.`);

  let fetched = 0;
  for (const url of urls) {
    if (progress[url]) continue;
    try {
      const $fighter = await fetchAndLoad(url);
      const details = parseFighterDetails($fighter);
      progress[url] = { sherdogUrl: url, nationality: details.nationality };
      fetched++;
      if (fetched % 25 === 0) {
        saveBackfillProgress(progress);
        console.log(`  ...${fetched} fetched this run (${Object.keys(progress).length}/${urls.length} total)`);
      }
    } catch (error) {
      console.warn(`  failed to fetch ${url}: ${(error as Error).message}`);
    }
  }
  saveBackfillProgress(progress);
  console.log(`Done fetching. ${Object.keys(progress).length}/${urls.length} fighter pages have data.`);

  // Apply results back onto every org's dataset, matched by name (the same natural key the
  // rest of the sync/seed scripts already rely on).
  for (const config of configs) {
    const dataset = loadDataset(config.orgKey);
    if (!dataset) continue;

    const nameToResult = new Map<string, BackfillResult>();
    for (const [url, name] of Object.entries(loadFighterUrlToName(config.orgKey))) {
      const result = progress[url];
      if (result) nameToResult.set(name, result);
    }
    if (nameToResult.size === 0) continue;

    let updated = 0;
    for (const fighter of dataset.fighters) {
      const result = nameToResult.get(fighter.name);
      if (!result) continue;
      fighter.nationality = result.nationality;
      updated++;
    }

    const outFile = path.join(SCRAPED_DIR, `${config.orgKey}.json`);
    fs.writeFileSync(outFile, JSON.stringify(dataset, null, 2));
    console.log(`[${config.orgKey}] backfilled nationality for ${updated}/${dataset.fighters.length} fighters -> ${outFile}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add data/scrapers/backfill-fighter-nationality.ts
git commit -m "feat(scrape): add one-off nationality backfill script"
```

---

## After the plan: running the backfill (operational, not a subagent task)

Tasks 1–6 make the code correct and ready. The following two commands actually populate the
data and are **run directly by the controller** (not dispatched as an implementer-subagent task
with spec/quality review) — this is a live, long-running operation against the production
database and third-party site, not a code change, so it doesn't fit the write-code/review/commit
shape the rest of this plan uses:

```bash
npx tsx data/scrapers/backfill-fighter-nationality.ts
```

Fetches all 6185 distinct already-known Sherdog fighter URLs (throttled to 1 request per 1.5s —
**roughly 2.5–3 hours**), writing `nationality` into each `data/scraped/{org}.json`. Safe to
interrupt and resume (checkpointed every 25 fighters in
`data/scraped/.cache/fighter-nationality-backfill-progress.json`). Run in the background and
monitor periodically rather than blocking on it.

Once that finishes, push the results into the live database (this is the same script Task 4
modified, and it already runs daily in production — running it once manually here just means the
data goes live today instead of waiting for tomorrow's 09:00 UTC cron):

```bash
npx tsx data/scrapers/sync-fighter-history.ts
```

Verify afterward with a quick count query against the live database (e.g. `SELECT COUNT(*) FROM
fighters WHERE nationality IS NOT NULL`) — expect it to jump from 0 to a large fraction of the
6185 backfilled URLs (not all of them: some Sherdog fighter pages genuinely have no flag).
