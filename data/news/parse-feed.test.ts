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
