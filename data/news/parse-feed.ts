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
      // item.isoDate is rss-parser's own pre-validated normalization of
      // pubDate/updated/published (confirmed present on both RSS 2.0 and
      // Atom items) — preferred over re-parsing the raw string ourselves,
      // falling back to pubDate for the rare item that lacks it.
      publishedAt: new Date(item.isoDate ?? item.pubDate!),
    }));
}

// Built via the RegExp constructor (not a /u-flagged literal) because the
// project's tsconfig has no explicit `target`, which TS defaults below ES6 —
// too low for TS to allow a literal regex with the `u` flag, even though the
// `u` flag itself works fine at runtime on any supported Node version.
const NON_WORD_CHARS = new RegExp('[^\\p{L}\\p{N}\\s]', 'gu');

/**
 * Lowercases, trims, strips punctuation, and collapses whitespace — used to
 * compare titles for near-duplicate detection across sources that cover the
 * same story with slightly different punctuation/casing.
 */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(NON_WORD_CHARS, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

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
