// data/news/parse-feed.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFeedXml, normalizeTitle, dedupeAgainstExisting } from './parse-feed';
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

test('parseFeedXml drops items whose link is not http(s)', async () => {
  const xml = loadFixture('unsafe-link-feed.xml');
  const articles = await parseFeedXml(xml, TEST_SOURCE);

  assert.equal(articles.length, 1);
  assert.equal(articles[0].title, 'Safe article');
});

function buildFeedXml(item: { title: string; link: string }): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test MMA News</title>
    <link>https://example-mma-news.test</link>
    <description>Test feed</description>
    <item>
      <title>${item.title}</title>
      <link>${item.link}</link>
      <description>Some article body.</description>
      <pubDate>Thu, 03 Sep 2026 14:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>
`;
}

test('parseFeedXml truncates a title over 490 characters', async () => {
  const longTitle = 'A'.repeat(500);
  const xml = buildFeedXml({ title: longTitle, link: 'https://example-mma-news.test/long-title' });
  const articles = await parseFeedXml(xml, TEST_SOURCE);

  assert.equal(articles.length, 1);
  assert.equal(articles[0].title.length, 490);
  assert.equal(articles[0].title, 'A'.repeat(490));
});

test('parseFeedXml drops (does not truncate) an item whose url exceeds 990 characters', async () => {
  const longPath = 'a'.repeat(1000);
  const longUrl = `https://example-mma-news.test/${longPath}`;
  const xml = buildFeedXml({ title: 'Article with an oversized url', link: longUrl });
  const articles = await parseFeedXml(xml, TEST_SOURCE);

  assert.deepEqual(articles, []);
});

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
