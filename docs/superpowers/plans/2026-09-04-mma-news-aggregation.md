# MMA News Aggregation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggregate MMA news from external RSS feeds (FR + EN sources) into a new `news_articles` table, refreshed by a Vercel Cron job, and surface them as a home-page section and a dedicated `/actualites` page — each article showing a title, image, excerpt, and a link out to the original source.

**Architecture:** Follows the existing scraper→DB→route→UI pattern (`data/scrapers/*` → Neon Postgres → `data/lib/data.ts` → Next.js routes), but with RSS parsing instead of HTML scraping and a cron-driven trigger instead of a manual npm script. Pure parsing/dedup logic lives in one file (`data/news/parse-feed.ts`, unit tested with fixtures); network + DB orchestration lives in a separate file (`data/news/fetch-news.ts`, not unit tested, consistent with the rest of the codebase).

**Tech Stack:** Next.js 14 App Router, Neon Postgres (`@neondatabase/serverless`), `rss-parser` (new dependency), Vercel Cron via `vercel.ts`, Tailwind CSS.

**Spec:** [docs/superpowers/specs/2026-09-04-mma-news-aggregation-design.md](../specs/2026-09-04-mma-news-aggregation-design.md)

---

## Before You Start

This plan assumes a fresh read of the spec above. Key decisions already made there (don't relitigate):
- Aggregation only, no original editorial content, no republishing full article text — extract + external link only.
- No automatic linking to fighter/event pages in this iteration; only a static per-source → organization mapping.
- No manual moderation queue — automatic dedup only (by URL via a DB unique constraint, and by near-duplicate title within a 48h window).
- Web only in this iteration; the read API is built so mobile can reuse it later, but no mobile UI is built now.

## Task 1: `news_articles` type and RSS source configuration

**Files:**
- Modify: [data/lib/definitions.ts](../../../data/lib/definitions.ts)
- Create: `data/news/sources.config.ts`
- Modify: [package.json](../../../package.json)

- [ ] **Step 1: Install `rss-parser`**

```bash
npm install rss-parser
```

Verify it landed in `dependencies` (not `devDependencies`) in `package.json` — it's used at runtime by the cron route, not just in scripts/tests.

- [ ] **Step 2: Add the `NewsArticle` type**

Add to the end of [data/lib/definitions.ts](../../../data/lib/definitions.ts):

```ts
export type NewsArticle = {
  id: number;
  source_id: string;
  org_id: number | null;
  title: string;
  excerpt: string;
  url: string;
  image_url: string | null;
  language: 'fr' | 'en';
  published_at: string;
  fetched_at: string;
};
```

- [ ] **Step 3: Create the source configuration**

Create `data/news/sources.config.ts`. Organization ids match `data/scrapers/orgs.config.ts` (1 = UFC, etc.) — `orgId: null` means the source isn't specific to one organization:

```ts
// data/news/sources.config.ts
export interface NewsSourceConfig {
  /** Short id used for logging and as `news_articles.source_id`. */
  sourceId: string;
  /** URL of the source's RSS/Atom feed. */
  feedUrl: string;
  /** organizations.id this source is dedicated to, or null if it covers multiple orgs. */
  orgId: number | null;
  language: 'fr' | 'en';
}

export const NEWS_SOURCES: NewsSourceConfig[] = [
  { sourceId: 'sherdog', feedUrl: 'https://www.sherdog.com/rss/news.xml', orgId: null, language: 'en' },
  { sourceId: 'mma-junkie', feedUrl: 'https://mmajunkie.usatoday.com/feed', orgId: null, language: 'en' },
  { sourceId: 'lequipe-mma', feedUrl: 'https://dwh.lequipe.fr/api/edito/rss?path=/Mma', orgId: null, language: 'fr' },
];
```

**Resolution (recorded after Task 1 ran):** `mma-junkie`'s feed URL, and every fallback path checked, resolve to a dead hostname (`archive.mmajunkie.com`, no DNS record). It was replaced with `mma-fighting`, verified working:

```ts
export const NEWS_SOURCES: NewsSourceConfig[] = [
  { sourceId: 'sherdog', feedUrl: 'https://www.sherdog.com/rss/news.xml', orgId: null, language: 'en' },
  { sourceId: 'mma-fighting', feedUrl: 'https://www.mmafighting.com/rss/index.xml', orgId: null, language: 'en' },
  { sourceId: 'lequipe-mma', feedUrl: 'https://dwh.lequipe.fr/api/edito/rss?path=/Mma', orgId: null, language: 'fr' },
];
```

Important: `mma-fighting`'s feed is **Atom, not RSS 2.0** (`<feed>`/`<entry>` instead of `<rss>`/`<item>`). `rss-parser` normalizes both formats to the same `item.link`/`item.pubDate`/`item.content`/`item.contentSnippet` shape — confirmed by parsing it directly. Two consequences carried into Task 2 below:
- Atom has no `<enclosure>`, so `imageUrl` is always `null` for this source (already handled by `NewsThumbnail`'s fallback icon — no code change needed for that).
- Atom's `<content>` holds the **full article body** (thousands of characters), not a short excerpt. `rss-parser` also exposes Atom's separate short `<summary>` as `item.summary` — Task 2's `parseFeedXml` must prefer that field over `contentSnippet`/`content` when present, and cap the result length regardless (defense in depth against any feed — RSS or Atom — that doesn't actually truncate). See the updated `parseFeedXml` in Task 2.

- [ ] **Step 4: Verify each feed URL actually returns RSS**

Run each of these and confirm the output starts with `<?xml` and contains `<item>` (or `<entry>` for Atom) elements — do not skip this, feed URLs move without notice:

```bash
curl -sIL https://www.sherdog.com/rss/news.xml | head -5
curl -s https://www.sherdog.com/rss/news.xml | head -30
curl -sIL https://mmajunkie.usatoday.com/feed | head -5
curl -s https://mmajunkie.usatoday.com/feed | head -30
curl -sIL "https://dwh.lequipe.fr/api/edito/rss?path=/Mma" | head -5
curl -s "https://dwh.lequipe.fr/api/edito/rss?path=/Mma" | head -30
```

If any URL 404s, redirects somewhere unexpected, or returns HTML instead of XML: open the site in a browser, view page source on its MMA/news landing page, and search for `<link rel="alternate" type="application/rss+xml"` — that tag's `href` is the real feed URL. If no such tag exists, try appending `/feed`, `/rss`, or `/feed.xml` to the section's URL (common WordPress/generic CMS conventions). Update `NEWS_SOURCES` with whatever URL actually works before moving on — a source with a dead feed URL will simply fail silently at ingestion time (see Task 4), so it's better to catch it now.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json data/lib/definitions.ts data/news/sources.config.ts
git commit -m "feat(news): add NewsArticle type and RSS source config

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

## Task 2: Pure RSS parsing (`parse-feed.ts`)

**Files:**
- Create: `data/news/parse-feed.ts`
- Test: `data/news/parse-feed.test.ts`
- Create: `data/news/__fixtures__/valid-feed.xml`
- Create: `data/news/__fixtures__/empty-feed.xml`
- Create: `data/news/__fixtures__/malformed-feed.xml`
- Create: `data/news/__fixtures__/atom-feed.xml`
- Create: `data/news/__fixtures__/long-description-feed.xml`

`rss-parser`'s `parseString()` maps an RSS `<description>` into both `item.content` and `item.contentSnippet` (already stripped of markup), an `<enclosure url="...">` into `item.enclosure.url`, and computes `item.isoDate` from `<pubDate>` — confirmed by running it locally against a sample feed. For **Atom** feeds it maps the same way (`item.link`/`item.pubDate`/`item.content`/`item.contentSnippet` all populated from the Atom equivalents) but *also* exposes Atom's short `<summary>` separately as `item.summary` — also confirmed locally. This matters here: one of the real sources configured in Task 1 (`mma-fighting`) is an Atom feed whose `<content>` is the full article body, not an excerpt, so `parseFeedXml` must prefer `item.summary` when it's present, and — as a safety net for any feed (Atom or RSS) that doesn't truncate — cap the excerpt length regardless of which field it came from.

- [ ] **Step 1: Create the fixtures**

Create `data/news/__fixtures__/valid-feed.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test MMA News</title>
    <link>https://example-mma-news.test</link>
    <description>Test feed</description>
    <item>
      <title>Jon Jones announces retirement plans</title>
      <link>https://example-mma-news.test/jon-jones-retirement</link>
      <description>Jon Jones said Wednesday that he is considering retirement after his next fight.</description>
      <pubDate>Thu, 03 Sep 2026 14:00:00 GMT</pubDate>
      <enclosure url="https://example-mma-news.test/images/jon-jones.jpg" type="image/jpeg" length="12345" />
    </item>
    <item>
      <title>UFC 320 fight card updated</title>
      <link>https://example-mma-news.test/ufc-320-card-update</link>
      <description>The UFC 320 fight card has been updated with a new co-main event.</description>
      <pubDate>Wed, 02 Sep 2026 09:30:00 GMT</pubDate>
    </item>
  </channel>
</rss>
```

Create `data/news/__fixtures__/empty-feed.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Empty Feed</title>
    <link>https://example-mma-news.test</link>
    <description>No items</description>
  </channel>
</rss>
```

Create `data/news/__fixtures__/malformed-feed.xml` (deliberately unterminated — `rss-parser` throws `Error: Unclosed root tag` on this, confirmed locally):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Broken Feed
    <item>
      <title>Missing closing tags
```

Create `data/news/__fixtures__/atom-feed.xml` — models `mma-fighting`'s real feed shape: a short `<summary>` alongside a much longer `<content>`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Test Atom MMA News</title>
  <link rel="alternate" type="text/html" href="https://example-mma-news.test" />
  <id>https://example-mma-news.test/atom</id>
  <updated>2026-09-03T14:00:00Z</updated>
  <entry>
    <title>Jon Jones announces retirement plans</title>
    <link rel="alternate" type="text/html" href="https://example-mma-news.test/jon-jones-retirement" />
    <id>https://example-mma-news.test/?p=1</id>
    <updated>2026-09-03T14:00:00Z</updated>
    <published>2026-09-03T14:00:00Z</published>
    <summary type="html"><![CDATA[Jon Jones said Wednesday that he is considering retirement after his next fight.]]></summary>
    <content type="html"><![CDATA[<p>Jon Jones said Wednesday that he is considering retirement after his next fight. This is a much longer full article body that goes on for a while with a lot more detail than the short summary above, covering his career, his opponents, and his plans for the future in extensive depth that would be far too long to show as a card excerpt on the news page.</p>]]></content>
  </entry>
</feed>
```

Create `data/news/__fixtures__/long-description-feed.xml` — an RSS 2.0 item whose `<description>` is 318 characters (over the 300-char cap), to prove truncation kicks in even without Atom's `<summary>` distinction:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test MMA News</title>
    <link>https://example-mma-news.test</link>
    <description>Test feed</description>
    <item>
      <title>Jon Jones retirement details in full</title>
      <link>https://example-mma-news.test/jon-jones-retirement-full</link>
      <description>Jon Jones said Wednesday that he is considering retirement after his next fight, citing a desire to spend more time with his family and explore business opportunities outside the octagon after more than a decade at the top of the heavyweight and light heavyweight divisions in mixed martial arts competition worldwide.</description>
      <pubDate>Thu, 03 Sep 2026 14:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>
```

- [ ] **Step 2: Write the failing tests**

Create `data/news/parse-feed.test.ts`:

```ts
// data/news/parse-feed.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFeedXml, normalizeTitle } from './parse-feed';
import type { NewsSourceConfig } from './sources.config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, '__fixtures__');

function loadFixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf-8');
}

const TEST_SOURCE: NewsSourceConfig = {
  sourceId: 'test-source',
  feedUrl: 'https://example-mma-news.test/rss',
  orgId: null,
  language: 'en',
};

test('parseFeedXml extracts and normalizes articles from a valid feed', async () => {
  const xml = loadFixture('valid-feed.xml');
  const articles = await parseFeedXml(xml, TEST_SOURCE);

  assert.equal(articles.length, 2);
  assert.deepEqual(articles[0], {
    sourceId: 'test-source',
    orgId: null,
    title: 'Jon Jones announces retirement plans',
    excerpt: 'Jon Jones said Wednesday that he is considering retirement after his next fight.',
    url: 'https://example-mma-news.test/jon-jones-retirement',
    imageUrl: 'https://example-mma-news.test/images/jon-jones.jpg',
    language: 'en',
    publishedAt: new Date('2026-09-03T14:00:00.000Z'),
  });
});

test('parseFeedXml sets imageUrl to null when the item has no enclosure', async () => {
  const xml = loadFixture('valid-feed.xml');
  const articles = await parseFeedXml(xml, TEST_SOURCE);

  assert.equal(articles[1].imageUrl, null);
  assert.equal(articles[1].title, 'UFC 320 fight card updated');
});

test('parseFeedXml returns an empty array for a feed with no items', async () => {
  const xml = loadFixture('empty-feed.xml');
  const articles = await parseFeedXml(xml, TEST_SOURCE);

  assert.deepEqual(articles, []);
});

test('parseFeedXml throws on malformed XML (caller is responsible for catching it)', async () => {
  const xml = loadFixture('malformed-feed.xml');
  await assert.rejects(() => parseFeedXml(xml, TEST_SOURCE));
});

test('normalizeTitle lowercases, trims, and collapses punctuation/whitespace', () => {
  assert.equal(
    normalizeTitle('  Jon Jones Announces RETIREMENT Plans!! '),
    'jon jones announces retirement plans',
  );
});

test('normalizeTitle treats titles differing only by punctuation as equal', () => {
  assert.equal(
    normalizeTitle("Jon Jones: 'I'm done'"),
    normalizeTitle('Jon Jones I m done'),
  );
});

test('parseFeedXml prefers the Atom <summary> over the full <content> body', async () => {
  const xml = loadFixture('atom-feed.xml');
  const articles = await parseFeedXml(xml, TEST_SOURCE);

  assert.equal(articles.length, 1);
  assert.equal(articles[0].excerpt, 'Jon Jones said Wednesday that he is considering retirement after his next fight.');
  assert.equal(articles[0].imageUrl, null); // Atom has no <enclosure>
});

test('parseFeedXml truncates an excerpt over 300 characters at a word boundary with an ellipsis', async () => {
  const xml = loadFixture('long-description-feed.xml');
  const articles = await parseFeedXml(xml, TEST_SOURCE);

  assert.equal(articles.length, 1);
  assert.ok(articles[0].excerpt.length <= 301); // 300 chars + the ellipsis character
  assert.ok(articles[0].excerpt.endsWith('…'));
  assert.equal(
    articles[0].excerpt,
    'Jon Jones said Wednesday that he is considering retirement after his next fight, citing a desire to spend more time with his family and explore business opportunities outside the octagon after more than a decade at the top of the heavyweight and light heavyweight divisions in mixed martial arts…',
  );
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test -- --test-name-pattern="parseFeedXml|normalizeTitle"`
Expected: FAIL with `Cannot find module './parse-feed'` (the module doesn't exist yet).

- [ ] **Step 4: Implement `parse-feed.ts`**

Create `data/news/parse-feed.ts`:

```ts
// data/news/parse-feed.ts
import Parser from 'rss-parser';
import type { NewsSourceConfig } from './sources.config';

export interface NormalizedNewsArticle {
  sourceId: string;
  orgId: number | null;
  title: string;
  excerpt: string;
  url: string;
  imageUrl: string | null;
  language: 'fr' | 'en';
  publishedAt: Date;
}

const parser = new Parser();

// Hard cap on excerpt length, regardless of which feed field it came from.
// Not just for Atom feeds whose <content> is the full article (see
// mma-fighting in sources.config.ts) — any RSS <description> that isn't
// properly truncated by its source hits this too. Keeps card UI consistent
// and stays well clear of ever republishing something that reads as the
// full article (see the design spec's "extrait court + lien externe" rule).
const EXCERPT_MAX_LENGTH = 300;

function truncateExcerpt(text: string, maxLength: number = EXCERPT_MAX_LENGTH): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;

  const cut = trimmed.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  const clean = lastSpace > 0 ? cut.slice(0, lastSpace) : cut;
  return `${clean}…`;
}

/**
 * Parses raw RSS/Atom XML into normalized articles. Pure aside from the
 * XML parsing itself — no network or DB access, so it's fully testable with
 * fixture strings. Throws if the XML is malformed; callers (fetch-news.ts)
 * are responsible for catching that per-source so one broken feed doesn't
 * take down the rest of the cron run.
 */
export async function parseFeedXml(xml: string, source: NewsSourceConfig): Promise<NormalizedNewsArticle[]> {
  const feed = await parser.parseString(xml);

  return (feed.items ?? [])
    .filter((item) => item.title && item.link && item.pubDate)
    .map((item) => ({
      sourceId: source.sourceId,
      orgId: source.orgId,
      title: item.title!.trim(),
      // item.summary only exists on Atom feeds (rss-parser's short-form
      // field) — it's the actual excerpt there, unlike item.content/
      // contentSnippet which hold the full article body for Atom. RSS 2.0
      // feeds never populate item.summary, so this falls through to
      // contentSnippet/content for them exactly as before.
      excerpt: truncateExcerpt(item.summary ?? item.contentSnippet ?? item.content ?? ''),
      url: item.link!,
      imageUrl: item.enclosure?.url ?? null,
      language: source.language,
      publishedAt: new Date(item.pubDate!),
    }));
}

/**
 * Lowercases, trims, strips punctuation, and collapses whitespace — used to
 * compare titles for near-duplicate detection across sources that cover the
 * same story with slightly different punctuation/casing.
 */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- --test-name-pattern="parseFeedXml|normalizeTitle"`
Expected: PASS, 8 tests.

- [ ] **Step 6: Commit**

```bash
git add data/news/parse-feed.ts data/news/parse-feed.test.ts data/news/__fixtures__
git commit -m "feat(news): pure RSS parsing and title normalization

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

## Task 3: Near-duplicate dedup logic

**Files:**
- Modify: `data/news/parse-feed.ts`
- Modify: `data/news/parse-feed.test.ts`

This stays in `parse-feed.ts` rather than a separate file: it's pure logic operating on the same `NormalizedNewsArticle` shape, and it's small enough that splitting it out would just add an import for no benefit.

- [ ] **Step 1: Write the failing tests**

Append to `data/news/parse-feed.test.ts` (add `dedupeAgainstExisting` to the existing import line):

```ts
import { parseFeedXml, normalizeTitle, dedupeAgainstExisting } from './parse-feed';
```

```ts
function makeArticle(overrides: Partial<import('./parse-feed').NormalizedNewsArticle> = {}) {
  return {
    sourceId: 'test-source',
    orgId: null,
    title: 'Jon Jones announces retirement plans',
    excerpt: 'excerpt',
    url: 'https://example-mma-news.test/article-1',
    imageUrl: null,
    language: 'en' as const,
    publishedAt: new Date('2026-09-03T14:00:00.000Z'),
    ...overrides,
  };
}

test('dedupeAgainstExisting keeps an article with no matching recent title', () => {
  const candidates = [makeArticle()];
  const result = dedupeAgainstExisting(candidates, []);
  assert.equal(result.length, 1);
});

test('dedupeAgainstExisting drops an article whose title matches a recent title within 48h', () => {
  const candidates = [makeArticle({ publishedAt: new Date('2026-09-03T14:00:00.000Z') })];
  const recentTitles = [
    { normalizedTitle: normalizeTitle('Jon Jones announces retirement plans'), publishedAt: new Date('2026-09-03T10:00:00.000Z') },
  ];
  const result = dedupeAgainstExisting(candidates, recentTitles);
  assert.deepEqual(result, []);
});

test('dedupeAgainstExisting keeps an article whose matching title is more than 48h old', () => {
  const candidates = [makeArticle({ publishedAt: new Date('2026-09-03T14:00:00.000Z') })];
  const recentTitles = [
    { normalizedTitle: normalizeTitle('Jon Jones announces retirement plans'), publishedAt: new Date('2026-09-01T00:00:00.000Z') },
  ];
  const result = dedupeAgainstExisting(candidates, recentTitles);
  assert.equal(result.length, 1);
});

test('dedupeAgainstExisting drops the second of two near-duplicate candidates in the same batch', () => {
  const candidates = [
    makeArticle({ url: 'https://example-mma-news.test/article-1', title: 'Jon Jones announces retirement plans' }),
    makeArticle({ url: 'https://example-mma-news.test/article-2', title: 'JON JONES ANNOUNCES RETIREMENT PLANS!' }),
  ];
  const result = dedupeAgainstExisting(candidates, []);
  assert.equal(result.length, 1);
  assert.equal(result[0].url, 'https://example-mma-news.test/article-1');
});

test('dedupeAgainstExisting keeps two candidates with unrelated titles', () => {
  const candidates = [
    makeArticle({ url: 'https://example-mma-news.test/article-1', title: 'Jon Jones announces retirement plans' }),
    makeArticle({ url: 'https://example-mma-news.test/article-2', title: 'UFC 320 fight card updated' }),
  ];
  const result = dedupeAgainstExisting(candidates, []);
  assert.equal(result.length, 2);
});

test('dedupeAgainstExisting returns an empty array for an empty input', () => {
  assert.deepEqual(dedupeAgainstExisting([], []), []);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- --test-name-pattern="dedupeAgainstExisting"`
Expected: FAIL with `dedupeAgainstExisting is not a function` (or a TS error that it's not exported).

- [ ] **Step 3: Implement `dedupeAgainstExisting`**

Append to `data/news/parse-feed.ts`:

```ts
export interface RecentTitle {
  normalizedTitle: string;
  publishedAt: Date;
}

const DEDUP_WINDOW_MS = 48 * 60 * 60 * 1000;

function isNearDuplicate(candidate: NormalizedNewsArticle, recent: RecentTitle): boolean {
  if (normalizeTitle(candidate.title) !== recent.normalizedTitle) return false;
  return Math.abs(candidate.publishedAt.getTime() - recent.publishedAt.getTime()) <= DEDUP_WINDOW_MS;
}

/**
 * Filters out articles whose (normalized) title matches one already seen
 * within the last 48h — either already in the DB (`recentTitles`, passed in
 * by the caller) or earlier in this same candidates array. Exact-URL
 * duplicates are NOT handled here: they're caught later by the `url` unique
 * constraint on `news_articles` at insert time (see fetch-news.ts).
 */
export function dedupeAgainstExisting(
  candidates: NormalizedNewsArticle[],
  recentTitles: RecentTitle[],
): NormalizedNewsArticle[] {
  const seen = [...recentTitles];
  const kept: NormalizedNewsArticle[] = [];

  for (const candidate of candidates) {
    const isDuplicate = seen.some((recent) => isNearDuplicate(candidate, recent));
    if (isDuplicate) continue;

    kept.push(candidate);
    seen.push({ normalizedTitle: normalizeTitle(candidate.title), publishedAt: candidate.publishedAt });
  }

  return kept;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- --test-name-pattern="dedupeAgainstExisting"`
Expected: PASS, 6 tests.

- [ ] **Step 5: Run the whole `data/news` test file to confirm nothing else broke**

Run: `npm test`
Expected: PASS, all tests including the 8 from Task 2 and the 6 from this task.

- [ ] **Step 6: Commit**

```bash
git add data/news/parse-feed.ts data/news/parse-feed.test.ts
git commit -m "feat(news): near-duplicate title detection within a 48h window

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

## Task 4: Ingestion orchestration (`fetch-news.ts`)

**Files:**
- Create: `data/news/fetch-news.ts`

No unit tests here — this is DB + network I/O, matching the rest of the codebase's convention (`data/lib/data.ts` isn't unit tested either; see the 2026-09-03 spec referenced in its own comments). Verified manually in Task 5 once the cron route exists.

- [ ] **Step 1: Implement `fetch-news.ts`**

Create `data/news/fetch-news.ts`:

```ts
// data/news/fetch-news.ts
import { sql } from '@/data/lib/db';
import { NEWS_SOURCES, type NewsSourceConfig } from './sources.config';
import { parseFeedXml, dedupeAgainstExisting, normalizeTitle, type RecentTitle } from './parse-feed';

const USER_AGENT = 'MMA-Universe-NewsBot/1.0 (hobby project; contact: donsacha27@gmail.com)';

export interface IngestSourceResult {
  sourceId: string;
  inserted: number;
  skipped: number;
  error: string | null;
}

async function ensureNewsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS news_articles (
      id SERIAL PRIMARY KEY,
      source_id VARCHAR(50) NOT NULL,
      org_id INT REFERENCES organizations(id),
      title VARCHAR(500) NOT NULL,
      excerpt TEXT,
      url VARCHAR(1000) NOT NULL UNIQUE,
      image_url VARCHAR(1000),
      language VARCHAR(2) NOT NULL,
      published_at TIMESTAMPTZ NOT NULL,
      fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS news_articles_published_at_idx ON news_articles (published_at DESC);`;
  await sql`CREATE INDEX IF NOT EXISTS news_articles_org_id_idx ON news_articles (org_id);`;
}

async function fetchRecentTitles(): Promise<RecentTitle[]> {
  // Literal '48 hours', not a bound parameter: data/lib/db.ts's `sql` tagged
  // template parameterizes every ${...} interpolation as a query parameter,
  // and Postgres doesn't accept `INTERVAL $1` — the interval's unit has to be
  // in the SQL text itself. Fine here since it's a hardcoded constant, not
  // user input — no injection concern. Matches dedupeAgainstExisting's own
  // 48h window (data/news/parse-feed.ts's DEDUP_WINDOW_MS) by convention;
  // if that ever changes, update this literal too (deliberately not sharing
  // a constant across a DB query and an in-memory duration — different units,
  // different files, not worth the coupling for one magic number each).
  const rows = await sql<{ title: string; published_at: string }>`
    SELECT title, published_at FROM news_articles
    WHERE published_at > now() - interval '48 hours'
  `;
  return rows.rows.map((row) => ({
    normalizedTitle: normalizeTitle(row.title),
    publishedAt: new Date(row.published_at),
  }));
}

/**
 * Ingests one source: fetch its feed, parse, dedupe against `recentTitles`
 * (mutated in place with whatever gets inserted, so later sources in the
 * same run see this source's new articles too), insert survivors.
 *
 * Every failure mode (network, HTTP status, malformed XML) is caught here
 * and turned into a result with `error` set — one broken source must never
 * stop the rest of the sources from being processed.
 */
async function ingestSource(source: NewsSourceConfig, recentTitles: RecentTitle[]): Promise<IngestSourceResult> {
  try {
    const response = await fetch(source.feedUrl, { headers: { 'User-Agent': USER_AGENT } });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} fetching ${source.feedUrl}`);
    }
    const xml = await response.text();
    const candidates = await parseFeedXml(xml, source);
    const toInsert = dedupeAgainstExisting(candidates, recentTitles);

    let inserted = 0;
    for (const article of toInsert) {
      const result = await sql<{ id: number }>`
        INSERT INTO news_articles (source_id, org_id, title, excerpt, url, image_url, language, published_at)
        VALUES (${article.sourceId}, ${article.orgId}, ${article.title}, ${article.excerpt}, ${article.url}, ${article.imageUrl}, ${article.language}, ${article.publishedAt.toISOString()})
        ON CONFLICT (url) DO NOTHING
        RETURNING id
      `;
      if (result.rows.length > 0) {
        inserted += 1;
        recentTitles.push({ normalizedTitle: normalizeTitle(article.title), publishedAt: article.publishedAt });
      }
    }

    return { sourceId: source.sourceId, inserted, skipped: toInsert.length - inserted, error: null };
  } catch (error) {
    console.error(`[news:${source.sourceId}] ingestion failed:`, error);
    return { sourceId: source.sourceId, inserted: 0, skipped: 0, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Ingests every configured source, one at a time (not Promise.all — see the
 * sequential-insert comment in app/seed/route.ts's seedOrganizations for why
 * concurrent inserts against Neon's HTTP driver are unreliable here too).
 */
export async function ingestAllSources(sources: NewsSourceConfig[] = NEWS_SOURCES): Promise<IngestSourceResult[]> {
  await ensureNewsTable();
  const recentTitles = await fetchRecentTitles();

  const results: IngestSourceResult[] = [];
  for (const source of sources) {
    results.push(await ingestSource(source, recentTitles));
  }
  return results;
}
```

- [ ] **Step 2: Commit**

```bash
git add data/news/fetch-news.ts
git commit -m "feat(news): RSS ingestion pipeline with per-source error isolation

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

## Task 5: Cron route + Vercel Cron configuration

**Files:**
- Create: `app/api/cron/news/route.ts`
- Create: `vercel.ts`
- Modify: [package.json](../../../package.json)
- Modify: `.env.local` (not committed — instructions only)

- [ ] **Step 1: Create the cron route**

Create `app/api/cron/news/route.ts`:

```ts
// app/api/cron/news/route.ts
import { NextResponse } from 'next/server';
import { ingestAllSources } from '@/data/news/fetch-news';

// Same reasoning as app/seed/route.ts: without this, @neondatabase/serverless's
// underlying fetch() calls can get swept into Next's Data Cache.
export const dynamic = 'force-dynamic';

// Vercel Cron calls this with GET. If CRON_SECRET is set (it is on Vercel by
// default for cron-triggered routes — see the Vercel Cron docs), only requests
// carrying it are allowed, so this route can't be triggered by anyone who finds
// the URL and spams it. Locally (no CRON_SECRET set), any request is allowed.
export async function GET(request: Request) {
  if (process.env.CRON_SECRET) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const results = await ingestAllSources();
  return NextResponse.json({ results });
}
```

- [ ] **Step 2: Manually verify the pipeline end-to-end against the dev DB — IF a working `DATABASE_URL` is available**

Check first: does `.env.local` exist with a real `DATABASE_URL`, or is one otherwise available in this environment? If NOT (no local Neon connection string, no `vercel env pull` access) — **skip this step entirely**, note in your report that live DB verification was skipped for lack of a `DATABASE_URL`, and rely on `tsc`/lint/a careful read-through instead. Do not attempt to fake or simulate this verification. The user has already been told this step may need to happen later (locally, or against a Vercel preview deployment) once real credentials are available.

If a working `DATABASE_URL` IS available:

```bash
npm run dev
```

In another terminal:

```bash
curl -s http://localhost:3000/api/cron/news | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(JSON.stringify(d,null,2))"
```

Expected: a `results` array with one entry per source in `NEWS_SOURCES`, each with `error: null` and `inserted` roughly matching that feed's current item count (`skipped` near 0 on a first run against an empty table). If any entry has a non-null `error`, read it — it's most likely a feed URL problem (see Task 1 Step 4's verification notes) rather than a code bug, since the `interval '48 hours'` query was already fixed to use a literal before Task 4 was implemented.

Then confirm rows actually landed:

```bash
curl -s "http://localhost:3000/api/cron/news" > /dev/null
```

(Second call — should now report `inserted: 0` for everything and `skipped` equal to each source's item count, proving the `ON CONFLICT (url) DO NOTHING` dedup works.)

- [ ] **Step 3: Add the Vercel Cron configuration**

Install `@vercel/config`:

```bash
npm install @vercel/config
```

Create `vercel.ts`:

```ts
// vercel.ts
import type { VercelConfig } from '@vercel/config/v1';

export const config: VercelConfig = {
  crons: [{ path: '/api/cron/news', schedule: '*/20 * * * *' }],
};
```

- [ ] **Step 4: Document the `CRON_SECRET` env var**

Vercel sets `CRON_SECRET` automatically for projects using Cron Jobs once one is configured, and signs its cron requests with it — no manual setup needed once this deploys. For local testing, leave `CRON_SECRET` unset in `.env.local` (Step 2 above already covered testing against local dev without it).

- [ ] **Step 5: Commit**

```bash
git add app/api/cron/news/route.ts vercel.ts package.json package-lock.json
git commit -m "feat(news): cron route and Vercel Cron schedule for RSS ingestion

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

## Task 6: Public read API (`fetchNewsArticles` + `/api/news`)

**Files:**
- Modify: [data/lib/data.ts](../../../data/lib/data.ts)
- Create: `app/api/news/route.ts`

- [ ] **Step 1: Add `fetchNewsArticles` to `data/lib/data.ts`**

Add near the other `fetch*` functions (same file, same conventions as `fetchFighters`):

```ts
export async function fetchNewsArticles({
  organizationId = null,
  page = 1,
  pageSize = 20,
}: {
  organizationId?: number | null;
  page?: number;
  pageSize?: number;
} = {}) {
  try {
    const offset = (page - 1) * pageSize;

    const data = await sql<NewsArticle & { organization_abbreviation: string | null; total_count: string }>`
      SELECT n.*, o.abbreviation AS organization_abbreviation, COUNT(*) OVER() AS total_count
      FROM news_articles n
      LEFT JOIN organizations o ON n.org_id = o.id
      WHERE (${organizationId}::int IS NULL OR n.org_id = ${organizationId})
      ORDER BY n.published_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    const total = data.rows.length > 0 ? Number(data.rows[0].total_count) : 0;
    return { articles: data.rows, total };
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch news articles.');
  }
}
```

Add `NewsArticle` to the existing import from `./definitions` at the top of the file.

- [ ] **Step 2: Create the public API route**

Create `app/api/news/route.ts`:

```ts
// app/api/news/route.ts
import { NextResponse } from 'next/server';
import { fetchNewsArticles } from '@/data/lib/data';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgParam = searchParams.get('org');
    const organizationId = orgParam && !Number.isNaN(Number(orgParam)) ? Number(orgParam) : null;
    const page = Math.max(1, Number(searchParams.get('page')) || 1);

    const { articles, total } = await fetchNewsArticles({ organizationId, page, pageSize: PAGE_SIZE });
    return NextResponse.json({ articles, total, page, pageSize: PAGE_SIZE });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Failed to fetch news' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Manually verify — IF a working `DATABASE_URL` is available**

Same caveat as Task 5 Step 2: if there's no working `DATABASE_URL` in this environment, skip this step (note it in the report) rather than fabricating a result. If one is available:

```bash
curl -s "http://localhost:3000/api/news?page=1" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('total:', d.total, 'articles:', d.articles.length)"
```

Expected: `total` matches the row count inserted earlier, `articles.length` is `min(total, 20)`.

- [ ] **Step 4: Commit**

```bash
git add data/lib/data.ts app/api/news/route.ts
git commit -m "feat(news): public paginated news read API

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

## Task 7: `NewsThumbnail` and `NewsCard` components

**Files:**
- Create: `components/ui/news/news-thumbnail.tsx`
- Create: `components/ui/news/news-card.tsx`

News images are hotlinked from whichever external site published the article — unlike fighter photos and event posters (Sherdog/ESPN, both already allow-listed in `next.config.mjs`'s `images.remotePatterns`), news thumbnails can come from an unbounded set of hosts that can't all be pre-registered there. `NewsThumbnail` therefore uses a plain `<img>` instead of `next/image`, following the same "state + onError fallback" shape as `components/ui/shared/media.tsx`'s `CoverImage`, but without the `next/image`-specific parts.

- [ ] **Step 1: Create `NewsThumbnail`**

Create `components/ui/news/news-thumbnail.tsx`:

```tsx
'use client';

import { useState } from 'react';

// Generic newspaper glyph — shown whenever the article has no image_url, or
// the URL we do have fails to load. Same fallback pattern as
// components/ui/shared/media.tsx's SilhouetteIcon, different glyph since this
// isn't a person.
function NewspaperIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M4 4a1 1 0 0 0-1 1v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2V9a1 1 0 0 0-1-1h-2V5a1 1 0 0 0-1-1H4Zm12 4V6H5v12a.5.5 0 0 0 .5.5H16V8Zm2 0v10.5a.5.5 0 0 0 .5-.5V8h-.5ZM6.5 8.5h6v2h-6v-2Zm0 3.5h6v1.5h-6V12Zm0 3h9v1.5h-9V15Z" />
    </svg>
  );
}

export default function NewsThumbnail({
  src,
  alt,
  className = '',
}: {
  src?: string | null;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className={`flex items-center justify-center bg-base-border ${className}`} aria-hidden="true">
        <NewspaperIcon className="h-1/3 w-1/3 text-ink-secondary/40" />
      </div>
    );
  }

  return (
    <div className={`overflow-hidden bg-base-border ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- external hosts vary
          per news source and can't all be pre-registered in next.config.mjs's
          images.remotePatterns, so next/image isn't usable here. */}
      <img src={src} alt={alt} className="h-full w-full object-cover" loading="lazy" onError={() => setFailed(true)} />
    </div>
  );
}
```

- [ ] **Step 2: Create `NewsCard`**

Create `components/ui/news/news-card.tsx`:

```tsx
import NewsThumbnail from '@/components/ui/news/news-thumbnail';
import { NewsArticle } from '@/data/lib/definitions';

function formatRelativeDate(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffHours = Math.round(diffMs / (60 * 60 * 1000));
  if (diffHours < 1) return "à l'instant";
  if (diffHours < 24) return `il y a ${diffHours} h`;
  const diffDays = Math.round(diffHours / 24);
  return `il y a ${diffDays} j`;
}

export default function NewsCard({
  article,
}: {
  article: NewsArticle & { organization_abbreviation?: string | null };
}) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col overflow-hidden rounded-lg border border-base-border bg-base-card transition-colors hover:border-accent"
    >
      <NewsThumbnail src={article.image_url} alt={article.title} className="aspect-video w-full" />
      <div className="flex flex-col gap-1 p-3">
        <span className="font-display text-xs uppercase tracking-wide text-accent">
          {article.organization_abbreviation ?? article.source_id}
        </span>
        <p className="line-clamp-2 font-display text-sm uppercase tracking-wide text-ink-primary">{article.title}</p>
        {article.excerpt && <p className="line-clamp-2 text-xs text-ink-secondary">{article.excerpt}</p>}
        <p className="text-xs text-ink-secondary">{formatRelativeDate(article.published_at)}</p>
      </div>
    </a>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/ui/news/news-thumbnail.tsx components/ui/news/news-card.tsx
git commit -m "feat(news): NewsThumbnail and NewsCard components

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

## Task 8: Home page "Actus" section

**Files:**
- Create: `components/ui/news/news-section.tsx`
- Modify: [app/page.tsx](../../../app/page.tsx)

- [ ] **Step 1: Create `NewsSection`**

Create `components/ui/news/news-section.tsx`:

```tsx
import Link from 'next/link';
import NewsCard from '@/components/ui/news/news-card';
import { NewsArticle } from '@/data/lib/definitions';

export default function NewsSection({
  articles,
}: {
  articles: (NewsArticle & { organization_abbreviation?: string | null })[];
}) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-lg uppercase tracking-wide text-ink-primary">Actus</h2>
        <Link href="/actualites" className="text-xs uppercase tracking-wide text-accent hover:underline">
          Voir toutes les actus
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {articles.map((article) => (
          <NewsCard key={article.id} article={article} />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Wire it into the home page**

In [app/page.tsx](../../../app/page.tsx):

Add to the imports:

```ts
import { fetchAllEvents, fetchFightsByEvent, fetchRecentFinishedFights, fetchNewsArticles } from '@/data/lib/data';
import NewsSection from '@/components/ui/news/news-section';
```

Add a constant next to `RECENT_RESULTS_COUNT`:

```ts
const HOME_NEWS_COUNT = 4;
```

In the `Promise.all` that fetches `nextEventFights`/`recentResults`, add a third entry:

```ts
const [nextEventFights, recentResults, news] = await Promise.all([
  next ? fetchFightsByEvent(String(next.event.id)) : Promise.resolve([]),
  fetchRecentFinishedFights(RECENT_RESULTS_COUNT),
  fetchNewsArticles({ pageSize: HOME_NEWS_COUNT }),
]);
```

After the "Derniers résultats" `<section>`, add:

```tsx
{news.articles.length > 0 && (
  <section>
    <NewsSection articles={news.articles} />
  </section>
)}
```

Wait — `NewsSection` already renders its own `<section>` (see Step 1); wrapping it in another `<section>` here would double-nest. Use it directly instead:

```tsx
{news.articles.length > 0 && <NewsSection articles={news.articles} />}
```

- [ ] **Step 3: Manually verify in the browser — IF a working `DATABASE_URL` is available**

Same caveat as Tasks 5/6: this environment has no `DATABASE_URL`, and the home page (`app/page.tsx`) already queries the DB for its existing sections regardless of this task's changes, so `npm run dev` can't render a working page here at all right now — this isn't a new limitation this task introduces. Skip this step (note it in the report) unless a working `DATABASE_URL` is available. If one is:

```bash
npm run dev
```

Open `http://localhost:3000`, confirm an "Actus" section appears below "Derniers résultats" with up to 4 article cards, each linking out to its source in a new tab, and a "Voir toutes les actus" link (this 404s until Task 9 — expected for now).

- [ ] **Step 4: Commit**

```bash
git add components/ui/news/news-section.tsx app/page.tsx
git commit -m "feat(news): Actus section on the home page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

## Task 9: `/actualites` page with organization filter and pagination

**Files:**
- Create: `components/ui/news/news-org-filter.tsx`
- Create: `components/ui/news/news-pagination.tsx`
- Create: `app/actualites/page.tsx`

- [ ] **Step 1: Create the organization filter**

Create `components/ui/news/news-org-filter.tsx`, following the same URL-driven pattern as `components/ui/fighters/fighters-search-bar.tsx`'s org `<select>` (no text search needed here, so no debounce/input):

```tsx
'use client';

import { Suspense } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Organization } from '@/data/lib/definitions';

function NewsOrgFilterInner({ organizations }: { organizations: Organization[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function selectOrg(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all') params.delete('org');
    else params.set('org', value);
    params.delete('page');
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <select
      value={searchParams.get('org') ?? 'all'}
      onChange={(event) => selectOrg(event.target.value)}
      aria-label="Filtrer par organisation"
      className="w-fit rounded-md border border-base-border bg-base-card px-3 py-2 text-sm text-ink-primary"
    >
      <option value="all">Toutes les organisations</option>
      {organizations.map((organization) => (
        <option key={organization.id} value={String(organization.id)}>
          {organization.abbreviation}
        </option>
      ))}
    </select>
  );
}

// useSearchParams() requires a Suspense boundary — without it, Next.js opts
// the whole page out of static rendering at build time.
export default function NewsOrgFilter(props: { organizations: Organization[] }) {
  return (
    <Suspense fallback={null}>
      <NewsOrgFilterInner {...props} />
    </Suspense>
  );
}
```

- [ ] **Step 2: Create pagination**

Create `components/ui/news/news-pagination.tsx`, adapted from `components/ui/fighters/fighters-pagination.tsx` (no `query` param here):

```tsx
import Link from 'next/link';

export default function NewsPagination({
  page,
  totalPages,
  organizationId,
}: {
  page: number;
  totalPages: number;
  organizationId?: string;
}) {
  if (totalPages <= 1) return null;

  function hrefForPage(target: number) {
    const params = new URLSearchParams();
    if (organizationId && organizationId !== 'all') params.set('org', organizationId);
    if (target > 1) params.set('page', String(target));
    const qs = params.toString();
    return qs ? `/actualites?${qs}` : '/actualites';
  }

  const hasPrevious = page > 1;
  const hasNext = page < totalPages;

  return (
    <div className="flex items-center justify-center gap-3 pt-2">
      <Link
        href={hasPrevious ? hrefForPage(page - 1) : hrefForPage(page)}
        aria-disabled={!hasPrevious}
        tabIndex={hasPrevious ? undefined : -1}
        className={`rounded-md border border-base-border px-3 py-1.5 text-sm text-ink-primary transition-colors ${
          hasPrevious ? 'hover:border-accent' : 'pointer-events-none opacity-40'
        }`}
      >
        Précédent
      </Link>
      <span className="text-sm text-ink-secondary">
        Page {page} / {totalPages}
      </span>
      <Link
        href={hasNext ? hrefForPage(page + 1) : hrefForPage(page)}
        aria-disabled={!hasNext}
        tabIndex={hasNext ? undefined : -1}
        className={`rounded-md border border-base-border px-3 py-1.5 text-sm text-ink-primary transition-colors ${
          hasNext ? 'hover:border-accent' : 'pointer-events-none opacity-40'
        }`}
      >
        Suivant
      </Link>
    </div>
  );
}
```

- [ ] **Step 3: Create the page**

Create `app/actualites/page.tsx`, following the same shape as `app/fighters/page.tsx`:

```tsx
import { fetchNewsArticles, fetchOrganizations } from '@/data/lib/data';
import NewsCard from '@/components/ui/news/news-card';
import NewsOrgFilter from '@/components/ui/news/news-org-filter';
import NewsPagination from '@/components/ui/news/news-pagination';
import EmptyState from '@/components/ui/shared/empty-state';

// Queries the DB on every request instead of at build time — Vercel's build
// step doesn't reliably have DATABASE_URL / DB access yet (see data/lib/db.ts).
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

export default async function ActualitesPage({
  searchParams,
}: {
  searchParams: { org?: string; page?: string };
}) {
  const organizationId =
    searchParams.org && searchParams.org !== 'all' && !Number.isNaN(Number(searchParams.org))
      ? Number(searchParams.org)
      : null;
  const page = Math.max(1, Number(searchParams.page) || 1);

  const [{ articles, total }, organizations] = await Promise.all([
    fetchNewsArticles({ organizationId, page, pageSize: PAGE_SIZE }),
    fetchOrganizations(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="flex min-h-screen flex-col gap-6 p-6">
      <h1 className="font-display text-2xl uppercase tracking-wide text-ink-primary">Actualités</h1>
      <NewsOrgFilter organizations={organizations} />
      {articles.length === 0 ? (
        <EmptyState
          title="Aucune actu pour le moment"
          description="Notre flux se met à jour automatiquement toutes les 20 minutes — reviens un peu plus tard."
        />
      ) : (
        <>
          <p className="text-xs text-ink-secondary">
            {total} actu{total > 1 ? 's' : ''}
          </p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {articles.map((article) => (
              <NewsCard key={article.id} article={article} />
            ))}
          </div>
        </>
      )}
      <NewsPagination page={page} totalPages={totalPages} organizationId={searchParams.org} />
    </main>
  );
}
```

- [ ] **Step 4: Manually verify in the browser — IF a working `DATABASE_URL` is available**

Same caveat as Tasks 5/6/8: no `DATABASE_URL` in this environment. Skip this step (note it in the report) unless one is available. If one is:

```bash
npm run dev
```

Open `http://localhost:3000/actualites`:
- Confirm articles render in a grid, newest first.
- Change the organization filter to one with `orgId: null` sources only (e.g. all current `NEWS_SOURCES` if none are org-specific yet) — confirm the list still renders correctly and the empty state shows correctly when a filter yields zero results.
- If there are more than 20 articles in the DB, confirm pagination controls appear and "Suivant"/"Précédent" work.
- From the home page, click "Voir toutes les actus" — confirm it lands here correctly.

- [ ] **Step 5: Commit**

```bash
git add components/ui/news/news-org-filter.tsx components/ui/news/news-pagination.tsx app/actualites/page.tsx
git commit -m "feat(news): /actualites page with organization filter and pagination

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

## Task 10: Full-suite verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS, every test in `data/**/*.test.ts` including the new `data/news/parse-feed.test.ts` (14 tests from Tasks 2–3).

- [ ] **Step 2: Run the linter**

Run: `npm run lint`
Expected: no errors. If the `NewsThumbnail`'s `<img>` triggers `@next/next/no-img-element` despite the inline disable comment, confirm the comment sits directly above the `<img>` line (ESLint disable-next-line comments are position-sensitive).

- [ ] **Step 3: Full manual walkthrough**

With `npm run dev` running:
1. `curl http://localhost:3000/api/cron/news` — confirm all sources report `error: null`.
2. Home page — "Actus" section shows real articles with images (or the newspaper fallback icon for articles without one).
3. `/actualites` — org filter and pagination both work.
4. Click an article card — confirm it opens the original source in a new tab, not a 404 or an internal page.

- [ ] **Step 4: Final commit if anything was fixed during verification**

```bash
git add -A
git commit -m "fix(news): address issues found during full-suite verification

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

(Skip this step if verification found nothing to fix.)

## Task 11: Post-final-review fixes

The final whole-branch review (after Task 10) found 1 Critical and 3 Important issues. This task addresses them.

### 11a. Critical: cron trigger mechanism

**Problem:** `vercel.ts`'s `*/20 * * * *` schedule is very likely incompatible with a Vercel Hobby (free) plan, which limits cron jobs to once/day — this can make the whole feature silently never run once deployed.

**Fix:** This project already has a working, plan-tier-independent scheduling mechanism: GitHub Actions (`.github/workflows/daily-sync.yml`, `.github/workflows/event-day-sync.yml`), which runs `tsx` scripts directly against `secrets.DATABASE_URL` on a cron schedule with no Vercel-plan dependency at all. Switch the news ingestion trigger to the same mechanism instead of Vercel Cron:

**Files:**
- Create: `data/news/run-ingest.ts` — a CLI entrypoint, following the exact `loadEnvLocal()` pattern from `data/scrapers/sync-ufc-rankings.ts` (tsx doesn't auto-load `.env.local`; GitHub Actions sets `DATABASE_URL` directly via `secrets.DATABASE_URL`, so `loadEnvLocal()` is a no-op there — it's only for local runs).
- Create: `.github/workflows/news-sync.yml` — mirrors `daily-sync.yml`'s structure (`on: schedule` + `workflow_dispatch`, `actions/checkout@v4`, `actions/setup-node@v4` at node 20, `npm ci`), but does NOT need `permissions: contents: write` (unlike the scraper workflows, this one never commits/pushes — it only writes to the DB).
- Modify: `vercel.ts` — remove the `crons` entry (GitHub Actions is now the trigger). If nothing else needs `@vercel/config`/`vercel.ts` at all, remove the file and the dependency entirely rather than leaving an empty config file.
- Modify: `app/api/cron/news/route.ts` — update the comment: this route is no longer the scheduled trigger, it's kept as a manually-triggerable HTTP endpoint (e.g. for an admin "refresh now" action later, or ad-hoc debugging via `curl` in production), still protected by the same optional `CRON_SECRET` check.

```ts
// data/news/run-ingest.ts
import fs from 'node:fs';
import path from 'node:path';
import { ingestAllSources } from './fetch-news';

// tsx doesn't auto-load .env.local the way Next.js does — same hand-rolled
// loader as data/scrapers/sync-ufc-rankings.ts. In GitHub Actions, DATABASE_URL
// is already set via secrets.DATABASE_URL, so this is a no-op there.
function loadEnvLocal() {
  const envPath = path.resolve('.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvLocal();

async function main() {
  const results = await ingestAllSources();
  console.log(JSON.stringify(results, null, 2));

  const allFailed = results.length > 0 && results.every((r) => r.error !== null);
  if (allFailed) {
    console.error('All news sources failed to ingest.');
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

```yaml
# .github/workflows/news-sync.yml
name: News sync

# Polls the RSS/Atom sources in data/news/sources.config.ts and ingests new
# articles into news_articles, every 20 minutes. Runs via GitHub Actions
# rather than Vercel Cron for the same reason the other scheduled jobs in
# this repo do (see daily-sync.yml / event-day-sync.yml): Vercel Cron's
# frequency is limited on non-Pro plans, GitHub Actions isn't.
on:
  schedule:
    - cron: '*/20 * * * *'
  workflow_dispatch: {}

concurrency:
  group: mma-universe-news-sync
  cancel-in-progress: false

jobs:
  ingest:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci

      - name: Ingest RSS news sources
        run: npx tsx data/news/run-ingest.ts
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

Verify: `npx tsc --noEmit` clean. `npm test` unaffected (no tests for this CLI script, consistent with the rest of `data/scrapers/*.ts`'s entrypoints, which are also untested — only the pure logic they call is tested, same principle already applied throughout this plan).

### 11b. Important: truncate `title`/`url`/`image_url` before insert

**Problem:** `excerpt` is defensively truncated (`truncateExcerpt` in `parse-feed.ts`), but `title` (`VARCHAR(500)`), `url`, and `image_url` (`VARCHAR(1000)` each) are not — an oversized value throws at `INSERT` time, aborts the rest of that source's batch for the run, and since the failed article never gets added to `recentTitles`, it's retried (and refails) on every subsequent run until it ages out of the source's feed.

**Fix:** In `data/news/parse-feed.ts`, add a small generic truncation helper and apply it to `title`, `url`, and `imageUrl` in `parseFeedXml`'s mapping, using limits comfortably under the actual column widths (leave headroom, don't truncate at exactly 500/1000):

```ts
const TITLE_MAX_LENGTH = 490;
const URL_MAX_LENGTH = 990;

function truncatePlain(text: string, maxLength: number): string {
  const trimmed = text.trim();
  return trimmed.length <= maxLength ? trimmed : trimmed.slice(0, maxLength);
}
```

Apply: `title: truncatePlain(item.title!.trim(), TITLE_MAX_LENGTH)`, `url: truncatePlain(item.link!, URL_MAX_LENGTH)`, `imageUrl: item.enclosure?.url ? truncatePlain(item.enclosure.url, URL_MAX_LENGTH) : null`.

A truncated `url` changes what the article links to (unlike `title`/`excerpt`, where truncation just shortens display text) — an oversized URL is already a pathological/unusual case (not something any of the 3 configured real sources produce), so simply dropping any item whose `url` exceeds the limit (via the same `.filter(...)` that already checks `title`/`link`/`pubDate`/http(s)-scheme) is more correct than silently truncating it into a broken link. Use judgment on this distinction: truncate `title`/`imageUrl` (cosmetic-only impact), filter out (don't truncate) an oversized `url`.

Add test cases to `data/news/parse-feed.test.ts` covering: a title over 490 chars gets truncated, a url over 990 chars gets the item dropped entirely (not truncated).

### 11c. Important: document the organization-filter no-op

**Problem:** All 3 configured sources have `orgId: null` (they're general MMA news sites, not org-specific), so `/actualites`'s organization filter currently has no selection that returns any results — it's correctly coded, just inert given current source data.

**Fix:** Add a one-line comment to `data/news/sources.config.ts` (near `NEWS_SOURCES`) noting this explicitly: the org filter UI is fully wired but will show no results for any specific organization until a source with a non-null `orgId` is added — this is expected with the current source list, not a bug.

### 11d. Important: document the `organizations` FK deploy-order dependency

**Problem:** `ensureNewsTable()`'s `org_id INT REFERENCES organizations(id)` requires the `organizations` table to already exist. On the current production DB this is already the case (seeded). On a brand-new/unseeded database (e.g. a fresh preview-branch DB), the first ingestion run fails until `/seed` has been hit once.

**Fix:** Add a one-line comment to `ensureNewsTable()` in `data/news/fetch-news.ts` documenting this deploy-order dependency (seed the `organizations` table — via `/seed` — before the news ingestion job runs against a brand-new database).

### Commit

One commit for all of 11a-11d (or split if it's cleaner to separate the cron-mechanism change from the smaller doc/truncation fixes — use judgment):

```bash
git commit -m "fix(news): switch cron trigger to GitHub Actions, truncate long fields, document known limitations

Findings from the final whole-branch review:
- vercel.ts's */20 cron likely exceeds Vercel Hobby plan's daily-only limit;
  switched to the same GitHub Actions cron mechanism already used by this
  repo's other scheduled jobs (see .github/workflows/daily-sync.yml).
- title/url/image_url weren't truncated before insert like excerpt already
  is, causing a recurring per-run failure for any oversized value.
- documented two known, accepted limitations (org filter is currently inert
  given all-null orgId sources; organizations must be seeded before the
  first ingestion run against a brand-new database).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
# MMA News Aggregation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggregate MMA news from external RSS feeds (FR + EN sources) into a new `news_articles` table, refreshed by a Vercel Cron job, and surface them as a home-page section and a dedicated `/actualites` page — each article showing a title, image, excerpt, and a link out to the original source.

**Architecture:** Follows the existing scraper→DB→route→UI pattern (`data/scrapers/*` → Neon Postgres → `data/lib/data.ts` → Next.js routes), but with RSS parsing instead of HTML scraping and a cron-driven trigger instead of a manual npm script. Pure parsing/dedup logic lives in one file (`data/news/parse-feed.ts`, unit tested with fixtures); network + DB orchestration lives in a separate file (`data/news/fetch-news.ts`, not unit tested, consistent with the rest of the codebase).

**Tech Stack:** Next.js 14 App Router, Neon Postgres (`@neondatabase/serverless`), `rss-parser` (new dependency), Vercel Cron via `vercel.ts`, Tailwind CSS.

**Spec:** [docs/superpowers/specs/2026-09-04-mma-news-aggregation-design.md](../specs/2026-09-04-mma-news-aggregation-design.md)

---

## Before You Start

This plan assumes a fresh read of the spec above. Key decisions already made there (don't relitigate):
- Aggregation only, no original editorial content, no republishing full article text — extract + external link only.
- No automatic linking to fighter/event pages in this iteration; only a static per-source → organization mapping.
- No manual moderation queue — automatic dedup only (by URL via a DB unique constraint, and by near-duplicate title within a 48h window).
- Web only in this iteration; the read API is built so mobile can reuse it later, but no mobile UI is built now.

## Task 1: `news_articles` type and RSS source configuration

**Files:**
- Modify: [data/lib/definitions.ts](../../../data/lib/definitions.ts)
- Create: `data/news/sources.config.ts`
- Modify: [package.json](../../../package.json)

- [ ] **Step 1: Install `rss-parser`**

```bash
npm install rss-parser
```

Verify it landed in `dependencies` (not `devDependencies`) in `package.json` — it's used at runtime by the cron route, not just in scripts/tests.

- [ ] **Step 2: Add the `NewsArticle` type**

Add to the end of [data/lib/definitions.ts](../../../data/lib/definitions.ts):

```ts
export type NewsArticle = {
  id: number;
  source_id: string;
  org_id: number | null;
  title: string;
  excerpt: string;
  url: string;
  image_url: string | null;
  language: 'fr' | 'en';
  published_at: string;
  fetched_at: string;
};
```

- [ ] **Step 3: Create the source configuration**

Create `data/news/sources.config.ts`. Organization ids match `data/scrapers/orgs.config.ts` (1 = UFC, etc.) — `orgId: null` means the source isn't specific to one organization:

```ts
// data/news/sources.config.ts
export interface NewsSourceConfig {
  /** Short id used for logging and as `news_articles.source_id`. */
  sourceId: string;
  /** URL of the source's RSS/Atom feed. */
  feedUrl: string;
  /** organizations.id this source is dedicated to, or null if it covers multiple orgs. */
  orgId: number | null;
  language: 'fr' | 'en';
}

export const NEWS_SOURCES: NewsSourceConfig[] = [
  { sourceId: 'sherdog', feedUrl: 'https://www.sherdog.com/rss/news.xml', orgId: null, language: 'en' },
  { sourceId: 'mma-junkie', feedUrl: 'https://mmajunkie.usatoday.com/feed', orgId: null, language: 'en' },
  { sourceId: 'lequipe-mma', feedUrl: 'https://dwh.lequipe.fr/api/edito/rss?path=/Mma', orgId: null, language: 'fr' },
];
```

- [ ] **Step 4: Verify each feed URL actually returns RSS**

Run each of these and confirm the output starts with `<?xml` and contains `<item>` (or `<entry>` for Atom) elements — do not skip this, feed URLs move without notice:

```bash
curl -sIL https://www.sherdog.com/rss/news.xml | head -5
curl -s https://www.sherdog.com/rss/news.xml | head -30
curl -sIL https://mmajunkie.usatoday.com/feed | head -5
curl -s https://mmajunkie.usatoday.com/feed | head -30
curl -sIL "https://dwh.lequipe.fr/api/edito/rss?path=/Mma" | head -5
curl -s "https://dwh.lequipe.fr/api/edito/rss?path=/Mma" | head -30
```

If any URL 404s, redirects somewhere unexpected, or returns HTML instead of XML: open the site in a browser, view page source on its MMA/news landing page, and search for `<link rel="alternate" type="application/rss+xml"` — that tag's `href` is the real feed URL. If no such tag exists, try appending `/feed`, `/rss`, or `/feed.xml` to the section's URL (common WordPress/generic CMS conventions). Update `NEWS_SOURCES` with whatever URL actually works before moving on — a source with a dead feed URL will simply fail silently at ingestion time (see Task 4), so it's better to catch it now.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json data/lib/definitions.ts data/news/sources.config.ts
git commit -m "feat(news): add NewsArticle type and RSS source config

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

## Task 2: Pure RSS parsing (`parse-feed.ts`)

**Files:**
- Create: `data/news/parse-feed.ts`
- Test: `data/news/parse-feed.test.ts`
- Create: `data/news/__fixtures__/valid-feed.xml`
- Create: `data/news/__fixtures__/empty-feed.xml`
- Create: `data/news/__fixtures__/malformed-feed.xml`

`rss-parser`'s `parseString()` maps a `<description>` into both `item.content` and `item.contentSnippet` (already stripped of markup), an `<enclosure url="...">` into `item.enclosure.url`, and computes `item.isoDate` from `<pubDate>` — confirmed by running it locally against a sample feed. `parseFeedXml` below relies on exactly those fields.

- [ ] **Step 1: Create the fixtures**

Create `data/news/__fixtures__/valid-feed.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test MMA News</title>
    <link>https://example-mma-news.test</link>
    <description>Test feed</description>
    <item>
      <title>Jon Jones announces retirement plans</title>
      <link>https://example-mma-news.test/jon-jones-retirement</link>
      <description>Jon Jones said Wednesday that he is considering retirement after his next fight.</description>
      <pubDate>Thu, 03 Sep 2026 14:00:00 GMT</pubDate>
      <enclosure url="https://example-mma-news.test/images/jon-jones.jpg" type="image/jpeg" length="12345" />
    </item>
    <item>
      <title>UFC 320 fight card updated</title>
      <link>https://example-mma-news.test/ufc-320-card-update</link>
      <description>The UFC 320 fight card has been updated with a new co-main event.</description>
      <pubDate>Wed, 02 Sep 2026 09:30:00 GMT</pubDate>
    </item>
  </channel>
</rss>
```

Create `data/news/__fixtures__/empty-feed.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Empty Feed</title>
    <link>https://example-mma-news.test</link>
    <description>No items</description>
  </channel>
</rss>
```

Create `data/news/__fixtures__/malformed-feed.xml` (deliberately unterminated — `rss-parser` throws `Error: Unclosed root tag` on this, confirmed locally):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Broken Feed
    <item>
      <title>Missing closing tags
```

- [ ] **Step 2: Write the failing tests**

Create `data/news/parse-feed.test.ts`:

```ts
// data/news/parse-feed.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFeedXml, normalizeTitle } from './parse-feed';
import type { NewsSourceConfig } from './sources.config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, '__fixtures__');

function loadFixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf-8');
}

const TEST_SOURCE: NewsSourceConfig = {
  sourceId: 'test-source',
  feedUrl: 'https://example-mma-news.test/rss',
  orgId: null,
  language: 'en',
};

test('parseFeedXml extracts and normalizes articles from a valid feed', async () => {
  const xml = loadFixture('valid-feed.xml');
  const articles = await parseFeedXml(xml, TEST_SOURCE);

  assert.equal(articles.length, 2);
  assert.deepEqual(articles[0], {
    sourceId: 'test-source',
    orgId: null,
    title: 'Jon Jones announces retirement plans',
    excerpt: 'Jon Jones said Wednesday that he is considering retirement after his next fight.',
    url: 'https://example-mma-news.test/jon-jones-retirement',
    imageUrl: 'https://example-mma-news.test/images/jon-jones.jpg',
    language: 'en',
    publishedAt: new Date('2026-09-03T14:00:00.000Z'),
  });
});

test('parseFeedXml sets imageUrl to null when the item has no enclosure', async () => {
  const xml = loadFixture('valid-feed.xml');
  const articles = await parseFeedXml(xml, TEST_SOURCE);

  assert.equal(articles[1].imageUrl, null);
  assert.equal(articles[1].title, 'UFC 320 fight card updated');
});

test('parseFeedXml returns an empty array for a feed with no items', async () => {
  const xml = loadFixture('empty-feed.xml');
  const articles = await parseFeedXml(xml, TEST_SOURCE);

  assert.deepEqual(articles, []);
});

test('parseFeedXml throws on malformed XML (caller is responsible for catching it)', async () => {
  const xml = loadFixture('malformed-feed.xml');
  await assert.rejects(() => parseFeedXml(xml, TEST_SOURCE));
});

test('normalizeTitle lowercases, trims, and collapses punctuation/whitespace', () => {
  assert.equal(
    normalizeTitle('  Jon Jones Announces RETIREMENT Plans!! '),
    'jon jones announces retirement plans',
  );
});

test('normalizeTitle treats titles differing only by punctuation as equal', () => {
  assert.equal(
    normalizeTitle("Jon Jones: 'I'm done'"),
    normalizeTitle('Jon Jones I m done'),
  );
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test -- --test-name-pattern="parseFeedXml|normalizeTitle"`
Expected: FAIL with `Cannot find module './parse-feed'` (the module doesn't exist yet).

- [ ] **Step 4: Implement `parse-feed.ts`**

Create `data/news/parse-feed.ts`:

```ts
// data/news/parse-feed.ts
import Parser from 'rss-parser';
import type { NewsSourceConfig } from './sources.config';

export interface NormalizedNewsArticle {
  sourceId: string;
  orgId: number | null;
  title: string;
  excerpt: string;
  url: string;
  imageUrl: string | null;
  language: 'fr' | 'en';
  publishedAt: Date;
}

const parser = new Parser();

/**
 * Parses raw RSS/Atom XML into normalized articles. Pure aside from the
 * XML parsing itself — no network or DB access, so it's fully testable with
 * fixture strings. Throws if the XML is malformed; callers (fetch-news.ts)
 * are responsible for catching that per-source so one broken feed doesn't
 * take down the rest of the cron run.
 */
export async function parseFeedXml(xml: string, source: NewsSourceConfig): Promise<NormalizedNewsArticle[]> {
  const feed = await parser.parseString(xml);

  return (feed.items ?? [])
    .filter((item) => item.title && item.link && item.pubDate)
    .map((item) => ({
      sourceId: source.sourceId,
      orgId: source.orgId,
      title: item.title!.trim(),
      excerpt: (item.contentSnippet ?? item.content ?? '').trim(),
      url: item.link!,
      imageUrl: item.enclosure?.url ?? null,
      language: source.language,
      publishedAt: new Date(item.pubDate!),
    }));
}

/**
 * Lowercases, trims, strips punctuation, and collapses whitespace — used to
 * compare titles for near-duplicate detection across sources that cover the
 * same story with slightly different punctuation/casing.
 */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- --test-name-pattern="parseFeedXml|normalizeTitle"`
Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
git add data/news/parse-feed.ts data/news/parse-feed.test.ts data/news/__fixtures__
git commit -m "feat(news): pure RSS parsing and title normalization

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

## Task 3: Near-duplicate dedup logic

**Files:**
- Modify: `data/news/parse-feed.ts`
- Modify: `data/news/parse-feed.test.ts`

This stays in `parse-feed.ts` rather than a separate file: it's pure logic operating on the same `NormalizedNewsArticle` shape, and it's small enough that splitting it out would just add an import for no benefit.

- [ ] **Step 1: Write the failing tests**

Append to `data/news/parse-feed.test.ts` (add `dedupeAgainstExisting` to the existing import line):

```ts
import { parseFeedXml, normalizeTitle, dedupeAgainstExisting } from './parse-feed';
```

```ts
function makeArticle(overrides: Partial<import('./parse-feed').NormalizedNewsArticle> = {}) {
  return {
    sourceId: 'test-source',
    orgId: null,
    title: 'Jon Jones announces retirement plans',
    excerpt: 'excerpt',
    url: 'https://example-mma-news.test/article-1',
    imageUrl: null,
    language: 'en' as const,
    publishedAt: new Date('2026-09-03T14:00:00.000Z'),
    ...overrides,
  };
}

test('dedupeAgainstExisting keeps an article with no matching recent title', () => {
  const candidates = [makeArticle()];
  const result = dedupeAgainstExisting(candidates, []);
  assert.equal(result.length, 1);
});

test('dedupeAgainstExisting drops an article whose title matches a recent title within 48h', () => {
  const candidates = [makeArticle({ publishedAt: new Date('2026-09-03T14:00:00.000Z') })];
  const recentTitles = [
    { normalizedTitle: normalizeTitle('Jon Jones announces retirement plans'), publishedAt: new Date('2026-09-03T10:00:00.000Z') },
  ];
  const result = dedupeAgainstExisting(candidates, recentTitles);
  assert.deepEqual(result, []);
});

test('dedupeAgainstExisting keeps an article whose matching title is more than 48h old', () => {
  const candidates = [makeArticle({ publishedAt: new Date('2026-09-03T14:00:00.000Z') })];
  const recentTitles = [
    { normalizedTitle: normalizeTitle('Jon Jones announces retirement plans'), publishedAt: new Date('2026-09-01T00:00:00.000Z') },
  ];
  const result = dedupeAgainstExisting(candidates, recentTitles);
  assert.equal(result.length, 1);
});

test('dedupeAgainstExisting drops the second of two near-duplicate candidates in the same batch', () => {
  const candidates = [
    makeArticle({ url: 'https://example-mma-news.test/article-1', title: 'Jon Jones announces retirement plans' }),
    makeArticle({ url: 'https://example-mma-news.test/article-2', title: 'JON JONES ANNOUNCES RETIREMENT PLANS!' }),
  ];
  const result = dedupeAgainstExisting(candidates, []);
  assert.equal(result.length, 1);
  assert.equal(result[0].url, 'https://example-mma-news.test/article-1');
});

test('dedupeAgainstExisting keeps two candidates with unrelated titles', () => {
  const candidates = [
    makeArticle({ url: 'https://example-mma-news.test/article-1', title: 'Jon Jones announces retirement plans' }),
    makeArticle({ url: 'https://example-mma-news.test/article-2', title: 'UFC 320 fight card updated' }),
  ];
  const result = dedupeAgainstExisting(candidates, []);
  assert.equal(result.length, 2);
});

test('dedupeAgainstExisting returns an empty array for an empty input', () => {
  assert.deepEqual(dedupeAgainstExisting([], []), []);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- --test-name-pattern="dedupeAgainstExisting"`
Expected: FAIL with `dedupeAgainstExisting is not a function` (or a TS error that it's not exported).

- [ ] **Step 3: Implement `dedupeAgainstExisting`**

Append to `data/news/parse-feed.ts`:

```ts
export interface RecentTitle {
  normalizedTitle: string;
  publishedAt: Date;
}

const DEDUP_WINDOW_MS = 48 * 60 * 60 * 1000;

function isNearDuplicate(candidate: NormalizedNewsArticle, recent: RecentTitle): boolean {
  if (normalizeTitle(candidate.title) !== recent.normalizedTitle) return false;
  return Math.abs(candidate.publishedAt.getTime() - recent.publishedAt.getTime()) <= DEDUP_WINDOW_MS;
}

/**
 * Filters out articles whose (normalized) title matches one already seen
 * within the last 48h — either already in the DB (`recentTitles`, passed in
 * by the caller) or earlier in this same candidates array. Exact-URL
 * duplicates are NOT handled here: they're caught later by the `url` unique
 * constraint on `news_articles` at insert time (see fetch-news.ts).
 */
export function dedupeAgainstExisting(
  candidates: NormalizedNewsArticle[],
  recentTitles: RecentTitle[],
): NormalizedNewsArticle[] {
  const seen = [...recentTitles];
  const kept: NormalizedNewsArticle[] = [];

  for (const candidate of candidates) {
    const isDuplicate = seen.some((recent) => isNearDuplicate(candidate, recent));
    if (isDuplicate) continue;

    kept.push(candidate);
    seen.push({ normalizedTitle: normalizeTitle(candidate.title), publishedAt: candidate.publishedAt });
  }

  return kept;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- --test-name-pattern="dedupeAgainstExisting"`
Expected: PASS, 6 tests.

- [ ] **Step 5: Run the whole `data/news` test file to confirm nothing else broke**

Run: `npm test`
Expected: PASS, all tests including the 6 from Task 2 and the 6 from this task.

- [ ] **Step 6: Commit**

```bash
git add data/news/parse-feed.ts data/news/parse-feed.test.ts
git commit -m "feat(news): near-duplicate title detection within a 48h window

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

## Task 4: Ingestion orchestration (`fetch-news.ts`)

**Files:**
- Create: `data/news/fetch-news.ts`

No unit tests here — this is DB + network I/O, matching the rest of the codebase's convention (`data/lib/data.ts` isn't unit tested either; see the 2026-09-03 spec referenced in its own comments). Verified manually in Task 5 once the cron route exists.

- [ ] **Step 1: Implement `fetch-news.ts`**

Create `data/news/fetch-news.ts`:

```ts
// data/news/fetch-news.ts
import { sql } from '@/data/lib/db';
import { NEWS_SOURCES, type NewsSourceConfig } from './sources.config';
import { parseFeedXml, dedupeAgainstExisting, normalizeTitle, type RecentTitle } from './parse-feed';

const USER_AGENT = 'MMA-Universe-NewsBot/1.0 (hobby project; contact: donsacha27@gmail.com)';
const RECENT_WINDOW_HOURS = 48;

export interface IngestSourceResult {
  sourceId: string;
  inserted: number;
  skipped: number;
  error: string | null;
}

async function ensureNewsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS news_articles (
      id SERIAL PRIMARY KEY,
      source_id VARCHAR(50) NOT NULL,
      org_id INT REFERENCES organizations(id),
      title VARCHAR(500) NOT NULL,
      excerpt TEXT,
      url VARCHAR(1000) NOT NULL UNIQUE,
      image_url VARCHAR(1000),
      language VARCHAR(2) NOT NULL,
      published_at TIMESTAMPTZ NOT NULL,
      fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS news_articles_published_at_idx ON news_articles (published_at DESC);`;
  await sql`CREATE INDEX IF NOT EXISTS news_articles_org_id_idx ON news_articles (org_id);`;
}

async function fetchRecentTitles(): Promise<RecentTitle[]> {
  const rows = await sql<{ title: string; published_at: string }>`
    SELECT title, published_at FROM news_articles
    WHERE published_at > now() - interval '${sql([`${RECENT_WINDOW_HOURS} hours`])}'
  `;
  return rows.rows.map((row) => ({
    normalizedTitle: normalizeTitle(row.title),
    publishedAt: new Date(row.published_at),
  }));
}

/**
 * Ingests one source: fetch its feed, parse, dedupe against `recentTitles`
 * (mutated in place with whatever gets inserted, so later sources in the
 * same run see this source's new articles too), insert survivors.
 *
 * Every failure mode (network, HTTP status, malformed XML) is caught here
 * and turned into a result with `error` set — one broken source must never
 * stop the rest of the sources from being processed.
 */
async function ingestSource(source: NewsSourceConfig, recentTitles: RecentTitle[]): Promise<IngestSourceResult> {
  try {
    const response = await fetch(source.feedUrl, { headers: { 'User-Agent': USER_AGENT } });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} fetching ${source.feedUrl}`);
    }
    const xml = await response.text();
    const candidates = await parseFeedXml(xml, source);
    const toInsert = dedupeAgainstExisting(candidates, recentTitles);

    let inserted = 0;
    for (const article of toInsert) {
      const result = await sql<{ id: number }>`
        INSERT INTO news_articles (source_id, org_id, title, excerpt, url, image_url, language, published_at)
        VALUES (${article.sourceId}, ${article.orgId}, ${article.title}, ${article.excerpt}, ${article.url}, ${article.imageUrl}, ${article.language}, ${article.publishedAt.toISOString()})
        ON CONFLICT (url) DO NOTHING
        RETURNING id
      `;
      if (result.rows.length > 0) {
        inserted += 1;
        recentTitles.push({ normalizedTitle: normalizeTitle(article.title), publishedAt: article.publishedAt });
      }
    }

    return { sourceId: source.sourceId, inserted, skipped: toInsert.length - inserted, error: null };
  } catch (error) {
    console.error(`[news:${source.sourceId}] ingestion failed:`, error);
    return { sourceId: source.sourceId, inserted: 0, skipped: 0, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Ingests every configured source, one at a time (not Promise.all — see the
 * sequential-insert comment in app/seed/route.ts's seedOrganizations for why
 * concurrent inserts against Neon's HTTP driver are unreliable here too).
 */
export async function ingestAllSources(sources: NewsSourceConfig[] = NEWS_SOURCES): Promise<IngestSourceResult[]> {
  await ensureNewsTable();
  const recentTitles = await fetchRecentTitles();

  const results: IngestSourceResult[] = [];
  for (const source of sources) {
    results.push(await ingestSource(source, recentTitles));
  }
  return results;
}
```

- [ ] **Step 2: Note on the `interval` query**

`data/lib/db.ts`'s `sql` tagged template parameterizes every interpolated value as a bound query parameter — that's correct for data values, but `INTERVAL '48 hours'` needs the hours count embedded in the SQL text itself, not passed as a parameter (Postgres doesn't accept `INTERVAL $1`). Confirm this by running the manual check in Task 5, Step 2 below; if it errors, replace the query with a literal instead of the `${sql([...])}` escape hatch:

```ts
const rows = await sql<{ title: string; published_at: string }>`
  SELECT title, published_at FROM news_articles
  WHERE published_at > now() - interval '48 hours'
`;
```

(`RECENT_WINDOW_HOURS` becomes unused if you take this route — remove the constant too.)

- [ ] **Step 3: Commit**

```bash
git add data/news/fetch-news.ts
git commit -m "feat(news): RSS ingestion pipeline with per-source error isolation

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

## Task 5: Cron route + Vercel Cron configuration

**Files:**
- Create: `app/api/cron/news/route.ts`
- Create: `vercel.ts`
- Modify: [package.json](../../../package.json)
- Modify: `.env.local` (not committed — instructions only)

- [ ] **Step 1: Create the cron route**

Create `app/api/cron/news/route.ts`:

```ts
// app/api/cron/news/route.ts
import { NextResponse } from 'next/server';
import { ingestAllSources } from '@/data/news/fetch-news';

// Same reasoning as app/seed/route.ts: without this, @neondatabase/serverless's
// underlying fetch() calls can get swept into Next's Data Cache.
export const dynamic = 'force-dynamic';

// Vercel Cron calls this with GET. If CRON_SECRET is set (it is on Vercel by
// default for cron-triggered routes — see the Vercel Cron docs), only requests
// carrying it are allowed, so this route can't be triggered by anyone who finds
// the URL and spams it. Locally (no CRON_SECRET set), any request is allowed.
export async function GET(request: Request) {
  if (process.env.CRON_SECRET) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const results = await ingestAllSources();
  return NextResponse.json({ results });
}
```

- [ ] **Step 2: Manually verify the pipeline end-to-end against the dev DB**

```bash
npm run dev
```

In another terminal:

```bash
curl -s http://localhost:3000/api/cron/news | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(JSON.stringify(d,null,2))"
```

Expected: a `results` array with one entry per source in `NEWS_SOURCES`, each with `error: null` and `inserted` roughly matching that feed's current item count (`skipped` near 0 on a first run against an empty table). If any entry has a non-null `error`, read it — it's either the interval-query issue from Task 4 Step 2, or a feed URL problem from Task 1 Step 4.

Then confirm rows actually landed:

```bash
curl -s "http://localhost:3000/api/cron/news" > /dev/null
```

(Second call — should now report `inserted: 0` for everything and `skipped` equal to each source's item count, proving the `ON CONFLICT (url) DO NOTHING` dedup works.)

- [ ] **Step 3: Add the Vercel Cron configuration**

Install `@vercel/config`:

```bash
npm install @vercel/config
```

Create `vercel.ts`:

```ts
// vercel.ts
import type { VercelConfig } from '@vercel/config/v1';

export const config: VercelConfig = {
  crons: [{ path: '/api/cron/news', schedule: '*/20 * * * *' }],
};
```

- [ ] **Step 4: Document the `CRON_SECRET` env var**

Vercel sets `CRON_SECRET` automatically for projects using Cron Jobs once one is configured, and signs its cron requests with it — no manual setup needed once this deploys. For local testing, leave `CRON_SECRET` unset in `.env.local` (Step 2 above already covered testing against local dev without it).

- [ ] **Step 5: Commit**

```bash
git add app/api/cron/news/route.ts vercel.ts package.json package-lock.json
git commit -m "feat(news): cron route and Vercel Cron schedule for RSS ingestion

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

## Task 6: Public read API (`fetchNewsArticles` + `/api/news`)

**Files:**
- Modify: [data/lib/data.ts](../../../data/lib/data.ts)
- Create: `app/api/news/route.ts`

- [ ] **Step 1: Add `fetchNewsArticles` to `data/lib/data.ts`**

Add near the other `fetch*` functions (same file, same conventions as `fetchFighters`):

```ts
export async function fetchNewsArticles({
  organizationId = null,
  page = 1,
  pageSize = 20,
}: {
  organizationId?: number | null;
  page?: number;
  pageSize?: number;
} = {}) {
  try {
    const offset = (page - 1) * pageSize;

    const data = await sql<NewsArticle & { organization_abbreviation: string | null; total_count: string }>`
      SELECT n.*, o.abbreviation AS organization_abbreviation, COUNT(*) OVER() AS total_count
      FROM news_articles n
      LEFT JOIN organizations o ON n.org_id = o.id
      WHERE (${organizationId}::int IS NULL OR n.org_id = ${organizationId})
      ORDER BY n.published_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    const total = data.rows.length > 0 ? Number(data.rows[0].total_count) : 0;
    return { articles: data.rows, total };
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch news articles.');
  }
}
```

Add `NewsArticle` to the existing import from `./definitions` at the top of the file.

- [ ] **Step 2: Create the public API route**

Create `app/api/news/route.ts`:

```ts
// app/api/news/route.ts
import { NextResponse } from 'next/server';
import { fetchNewsArticles } from '@/data/lib/data';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgParam = searchParams.get('org');
    const organizationId = orgParam && !Number.isNaN(Number(orgParam)) ? Number(orgParam) : null;
    const page = Math.max(1, Number(searchParams.get('page')) || 1);

    const { articles, total } = await fetchNewsArticles({ organizationId, page, pageSize: PAGE_SIZE });
    return NextResponse.json({ articles, total, page, pageSize: PAGE_SIZE });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Failed to fetch news' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Manually verify**

```bash
curl -s "http://localhost:3000/api/news?page=1" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('total:', d.total, 'articles:', d.articles.length)"
```

Expected: `total` matches the row count inserted in Task 5 Step 2, `articles.length` is `min(total, 20)`.

- [ ] **Step 4: Commit**

```bash
git add data/lib/data.ts app/api/news/route.ts
git commit -m "feat(news): public paginated news read API

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

## Task 7: `NewsThumbnail` and `NewsCard` components

**Files:**
- Create: `components/ui/news/news-thumbnail.tsx`
- Create: `components/ui/news/news-card.tsx`

News images are hotlinked from whichever external site published the article — unlike fighter photos and event posters (Sherdog/ESPN, both already allow-listed in `next.config.mjs`'s `images.remotePatterns`), news thumbnails can come from an unbounded set of hosts that can't all be pre-registered there. `NewsThumbnail` therefore uses a plain `<img>` instead of `next/image`, following the same "state + onError fallback" shape as `components/ui/shared/media.tsx`'s `CoverImage`, but without the `next/image`-specific parts.

- [ ] **Step 1: Create `NewsThumbnail`**

Create `components/ui/news/news-thumbnail.tsx`:

```tsx
'use client';

import { useState } from 'react';

// Generic newspaper glyph — shown whenever the article has no image_url, or
// the URL we do have fails to load. Same fallback pattern as
// components/ui/shared/media.tsx's SilhouetteIcon, different glyph since this
// isn't a person.
function NewspaperIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M4 4a1 1 0 0 0-1 1v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2V9a1 1 0 0 0-1-1h-2V5a1 1 0 0 0-1-1H4Zm12 4V6H5v12a.5.5 0 0 0 .5.5H16V8Zm2 0v10.5a.5.5 0 0 0 .5-.5V8h-.5ZM6.5 8.5h6v2h-6v-2Zm0 3.5h6v1.5h-6V12Zm0 3h9v1.5h-9V15Z" />
    </svg>
  );
}

export default function NewsThumbnail({
  src,
  alt,
  className = '',
}: {
  src?: string | null;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className={`flex items-center justify-center bg-base-border ${className}`} aria-hidden="true">
        <NewspaperIcon className="h-1/3 w-1/3 text-ink-secondary/40" />
      </div>
    );
  }

  return (
    <div className={`overflow-hidden bg-base-border ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- external hosts vary
          per news source and can't all be pre-registered in next.config.mjs's
          images.remotePatterns, so next/image isn't usable here. */}
      <img src={src} alt={alt} className="h-full w-full object-cover" loading="lazy" onError={() => setFailed(true)} />
    </div>
  );
}
```

- [ ] **Step 2: Create `NewsCard`**

Create `components/ui/news/news-card.tsx`:

```tsx
import NewsThumbnail from '@/components/ui/news/news-thumbnail';
import { NewsArticle } from '@/data/lib/definitions';

function formatRelativeDate(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffHours = Math.round(diffMs / (60 * 60 * 1000));
  if (diffHours < 1) return "à l'instant";
  if (diffHours < 24) return `il y a ${diffHours} h`;
  const diffDays = Math.round(diffHours / 24);
  return `il y a ${diffDays} j`;
}

export default function NewsCard({
  article,
}: {
  article: NewsArticle & { organization_abbreviation?: string | null };
}) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col overflow-hidden rounded-lg border border-base-border bg-base-card transition-colors hover:border-accent"
    >
      <NewsThumbnail src={article.image_url} alt={article.title} className="aspect-video w-full" />
      <div className="flex flex-col gap-1 p-3">
        <span className="font-display text-xs uppercase tracking-wide text-accent">
          {article.organization_abbreviation ?? article.source_id}
        </span>
        <p className="line-clamp-2 font-display text-sm uppercase tracking-wide text-ink-primary">{article.title}</p>
        {article.excerpt && <p className="line-clamp-2 text-xs text-ink-secondary">{article.excerpt}</p>}
        <p className="text-xs text-ink-secondary">{formatRelativeDate(article.published_at)}</p>
      </div>
    </a>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/ui/news/news-thumbnail.tsx components/ui/news/news-card.tsx
git commit -m "feat(news): NewsThumbnail and NewsCard components

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

## Task 8: Home page "Actus" section

**Files:**
- Create: `components/ui/news/news-section.tsx`
- Modify: [app/page.tsx](../../../app/page.tsx)

- [ ] **Step 1: Create `NewsSection`**

Create `components/ui/news/news-section.tsx`:

```tsx
import Link from 'next/link';
import NewsCard from '@/components/ui/news/news-card';
import { NewsArticle } from '@/data/lib/definitions';

export default function NewsSection({
  articles,
}: {
  articles: (NewsArticle & { organization_abbreviation?: string | null })[];
}) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-lg uppercase tracking-wide text-ink-primary">Actus</h2>
        <Link href="/actualites" className="text-xs uppercase tracking-wide text-accent hover:underline">
          Voir toutes les actus
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {articles.map((article) => (
          <NewsCard key={article.id} article={article} />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Wire it into the home page**

In [app/page.tsx](../../../app/page.tsx):

Add to the imports:

```ts
import { fetchAllEvents, fetchFightsByEvent, fetchRecentFinishedFights, fetchNewsArticles } from '@/data/lib/data';
import NewsSection from '@/components/ui/news/news-section';
```

Add a constant next to `RECENT_RESULTS_COUNT`:

```ts
const HOME_NEWS_COUNT = 4;
```

In the `Promise.all` that fetches `nextEventFights`/`recentResults`, add a third entry:

```ts
const [nextEventFights, recentResults, news] = await Promise.all([
  next ? fetchFightsByEvent(String(next.event.id)) : Promise.resolve([]),
  fetchRecentFinishedFights(RECENT_RESULTS_COUNT),
  fetchNewsArticles({ pageSize: HOME_NEWS_COUNT }),
]);
```

After the "Derniers résultats" `<section>`, add:

```tsx
{news.articles.length > 0 && (
  <section>
    <NewsSection articles={news.articles} />
  </section>
)}
```

Wait — `NewsSection` already renders its own `<section>` (see Step 1); wrapping it in another `<section>` here would double-nest. Use it directly instead:

```tsx
{news.articles.length > 0 && <NewsSection articles={news.articles} />}
```

- [ ] **Step 3: Manually verify in the browser**

```bash
npm run dev
```

Open `http://localhost:3000`, confirm an "Actus" section appears below "Derniers résultats" with up to 4 article cards, each linking out to its source in a new tab, and a "Voir toutes les actus" link (this 404s until Task 9 — expected for now).

- [ ] **Step 4: Commit**

```bash
git add components/ui/news/news-section.tsx app/page.tsx
git commit -m "feat(news): Actus section on the home page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

## Task 9: `/actualites` page with organization filter and pagination

**Files:**
- Create: `components/ui/news/news-org-filter.tsx`
- Create: `components/ui/news/news-pagination.tsx`
- Create: `app/actualites/page.tsx`

- [ ] **Step 1: Create the organization filter**

Create `components/ui/news/news-org-filter.tsx`, following the same URL-driven pattern as `components/ui/fighters/fighters-search-bar.tsx`'s org `<select>` (no text search needed here, so no debounce/input):

```tsx
'use client';

import { Suspense } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Organization } from '@/data/lib/definitions';

function NewsOrgFilterInner({ organizations }: { organizations: Organization[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function selectOrg(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all') params.delete('org');
    else params.set('org', value);
    params.delete('page');
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <select
      value={searchParams.get('org') ?? 'all'}
      onChange={(event) => selectOrg(event.target.value)}
      aria-label="Filtrer par organisation"
      className="w-fit rounded-md border border-base-border bg-base-card px-3 py-2 text-sm text-ink-primary"
    >
      <option value="all">Toutes les organisations</option>
      {organizations.map((organization) => (
        <option key={organization.id} value={String(organization.id)}>
          {organization.abbreviation}
        </option>
      ))}
    </select>
  );
}

// useSearchParams() requires a Suspense boundary — without it, Next.js opts
// the whole page out of static rendering at build time.
export default function NewsOrgFilter(props: { organizations: Organization[] }) {
  return (
    <Suspense fallback={null}>
      <NewsOrgFilterInner {...props} />
    </Suspense>
  );
}
```

- [ ] **Step 2: Create pagination**

Create `components/ui/news/news-pagination.tsx`, adapted from `components/ui/fighters/fighters-pagination.tsx` (no `query` param here):

```tsx
import Link from 'next/link';

export default function NewsPagination({
  page,
  totalPages,
  organizationId,
}: {
  page: number;
  totalPages: number;
  organizationId?: string;
}) {
  if (totalPages <= 1) return null;

  function hrefForPage(target: number) {
    const params = new URLSearchParams();
    if (organizationId && organizationId !== 'all') params.set('org', organizationId);
    if (target > 1) params.set('page', String(target));
    const qs = params.toString();
    return qs ? `/actualites?${qs}` : '/actualites';
  }

  const hasPrevious = page > 1;
  const hasNext = page < totalPages;

  return (
    <div className="flex items-center justify-center gap-3 pt-2">
      <Link
        href={hasPrevious ? hrefForPage(page - 1) : hrefForPage(page)}
        aria-disabled={!hasPrevious}
        tabIndex={hasPrevious ? undefined : -1}
        className={`rounded-md border border-base-border px-3 py-1.5 text-sm text-ink-primary transition-colors ${
          hasPrevious ? 'hover:border-accent' : 'pointer-events-none opacity-40'
        }`}
      >
        Précédent
      </Link>
      <span className="text-sm text-ink-secondary">
        Page {page} / {totalPages}
      </span>
      <Link
        href={hasNext ? hrefForPage(page + 1) : hrefForPage(page)}
        aria-disabled={!hasNext}
        tabIndex={hasNext ? undefined : -1}
        className={`rounded-md border border-base-border px-3 py-1.5 text-sm text-ink-primary transition-colors ${
          hasNext ? 'hover:border-accent' : 'pointer-events-none opacity-40'
        }`}
      >
        Suivant
      </Link>
    </div>
  );
}
```

- [ ] **Step 3: Create the page**

Create `app/actualites/page.tsx`, following the same shape as `app/fighters/page.tsx`:

```tsx
import { fetchNewsArticles, fetchOrganizations } from '@/data/lib/data';
import NewsCard from '@/components/ui/news/news-card';
import NewsOrgFilter from '@/components/ui/news/news-org-filter';
import NewsPagination from '@/components/ui/news/news-pagination';
import EmptyState from '@/components/ui/shared/empty-state';

// Queries the DB on every request instead of at build time — Vercel's build
// step doesn't reliably have DATABASE_URL / DB access yet (see data/lib/db.ts).
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

export default async function ActualitesPage({
  searchParams,
}: {
  searchParams: { org?: string; page?: string };
}) {
  const organizationId =
    searchParams.org && searchParams.org !== 'all' && !Number.isNaN(Number(searchParams.org))
      ? Number(searchParams.org)
      : null;
  const page = Math.max(1, Number(searchParams.page) || 1);

  const [{ articles, total }, organizations] = await Promise.all([
    fetchNewsArticles({ organizationId, page, pageSize: PAGE_SIZE }),
    fetchOrganizations(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="flex min-h-screen flex-col gap-6 p-6">
      <h1 className="font-display text-2xl uppercase tracking-wide text-ink-primary">Actualités</h1>
      <NewsOrgFilter organizations={organizations} />
      {articles.length === 0 ? (
        <EmptyState
          title="Aucune actu pour le moment"
          description="Notre flux se met à jour automatiquement toutes les 20 minutes — reviens un peu plus tard."
        />
      ) : (
        <>
          <p className="text-xs text-ink-secondary">
            {total} actu{total > 1 ? 's' : ''}
          </p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {articles.map((article) => (
              <NewsCard key={article.id} article={article} />
            ))}
          </div>
        </>
      )}
      <NewsPagination page={page} totalPages={totalPages} organizationId={searchParams.org} />
    </main>
  );
}
```

- [ ] **Step 4: Manually verify in the browser**

```bash
npm run dev
```

Open `http://localhost:3000/actualites`:
- Confirm articles render in a grid, newest first.
- Change the organization filter to one with `orgId: null` sources only (e.g. all current `NEWS_SOURCES` if none are org-specific yet) — confirm the list still renders correctly and the empty state shows correctly when a filter yields zero results.
- If there are more than 20 articles in the DB, confirm pagination controls appear and "Suivant"/"Précédent" work.
- From the home page, click "Voir toutes les actus" — confirm it lands here correctly.

- [ ] **Step 5: Commit**

```bash
git add components/ui/news/news-org-filter.tsx components/ui/news/news-pagination.tsx app/actualites/page.tsx
git commit -m "feat(news): /actualites page with organization filter and pagination

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

## Task 10: Full-suite verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS, every test in `data/**/*.test.ts` including the new `data/news/parse-feed.test.ts` (12 tests from Tasks 2–3).

- [ ] **Step 2: Run the linter**

Run: `npm run lint`
Expected: no errors. If the `NewsThumbnail`'s `<img>` triggers `@next/next/no-img-element` despite the inline disable comment, confirm the comment sits directly above the `<img>` line (ESLint disable-next-line comments are position-sensitive).

- [ ] **Step 3: Full manual walkthrough**

With `npm run dev` running:
1. `curl http://localhost:3000/api/cron/news` — confirm all sources report `error: null`.
2. Home page — "Actus" section shows real articles with images (or the newspaper fallback icon for articles without one).
3. `/actualites` — org filter and pagination both work.
4. Click an article card — confirm it opens the original source in a new tab, not a 404 or an internal page.

- [ ] **Step 4: Final commit if anything was fixed during verification**

```bash
git add -A
git commit -m "fix(news): address issues found during full-suite verification

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

(Skip this step if verification found nothing to fix.)
