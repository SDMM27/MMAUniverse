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

// NOTE: 'mma-junkie' (https://mmajunkie.usatoday.com/feed) is deliberately
// omitted here. As of 2026-09-04 that URL — and every other path checked
// (mmajunkie.com/feed, /rss, /rss.xml, /feed.xml, /arc/outboundfeeds/rss/) —
// redirects through mmajunkie-eu.usatoday.com to https://archive.mmajunkie.com,
// a hostname that does not resolve (confirmed via public DNS-over-HTTPS, not
// just this sandbox's resolver). mmajunkie.usatoday.com's own page source
// also has no <link rel="alternate" type="application/rss+xml"> pointing
// anywhere else. There is currently no working RSS feed for this source; see
// Task 1 report for details before deciding whether to substitute another
// English-language source.
export const NEWS_SOURCES: NewsSourceConfig[] = [
  { sourceId: 'sherdog', feedUrl: 'https://www.sherdog.com/rss/news.xml', orgId: null, language: 'en' },
  { sourceId: 'lequipe-mma', feedUrl: 'https://dwh.lequipe.fr/api/edito/rss?path=/Mma', orgId: null, language: 'fr' },
];
