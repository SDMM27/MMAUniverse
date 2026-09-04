// data/news/fetch-news.ts
import { sql } from '@/data/lib/db';
import { NEWS_SOURCES, type NewsSourceConfig } from './sources.config';
import { parseFeedXml, dedupeAgainstExisting, normalizeTitle, type RecentTitle } from './parse-feed';

const USER_AGENT = 'MMA-Universe-NewsBot/1.0 (hobby project; contact: donsacha27@gmail.com)';
const FETCH_TIMEOUT_MS = 10_000;

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
  let inserted = 0;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(source.feedUrl, { headers: { 'User-Agent': USER_AGENT }, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} fetching ${source.feedUrl}`);
    }
    const xml = await response.text();
    const candidates = await parseFeedXml(xml, source);
    const toInsert = dedupeAgainstExisting(candidates, recentTitles);

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
    return { sourceId: source.sourceId, inserted, skipped: 0, error: error instanceof Error ? error.message : String(error) };
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
