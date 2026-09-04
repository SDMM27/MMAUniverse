// app/api/cron/news/route.ts
import { NextResponse } from 'next/server';
import { ingestAllSources } from '@/data/news/fetch-news';

// Same reasoning as app/seed/route.ts: without this, @neondatabase/serverless's
// underlying fetch() calls can get swept into Next's Data Cache.
export const dynamic = 'force-dynamic';

// News ingestion is actually scheduled via GitHub Actions (see
// .github/workflows/news-sync.yml + data/news/run-ingest.ts), not Vercel
// Cron — Vercel Cron's frequency is limited on non-Pro plans, which the
// */20-minute cadence this feature needs would very likely have exceeded.
// This route is kept as a manually-triggerable HTTP endpoint (e.g. an admin
// "refresh now" action later, or ad-hoc debugging via curl in production),
// still gated by CRON_SECRET when it's set (it is on Vercel by default for
// cron-triggered routes — see the Vercel Cron docs), so it can't be hit by
// anyone who finds the URL and spams it. Locally (no CRON_SECRET set), any
// request is allowed.
export async function GET(request: Request) {
  if (process.env.CRON_SECRET) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const results = await ingestAllSources();

    // ingestAllSources() isolates per-source failures into each result's `error`
    // field rather than throwing, so a total upstream outage (every source
    // failing) would otherwise still report HTTP 200. Vercel Cron's own health
    // monitoring keys off status code, so surface that case as a failure.
    const allFailed = results.length > 0 && results.every((r) => r.error !== null);
    if (allFailed) {
      return NextResponse.json({ results }, { status: 502 });
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Failed to ingest news' }, { status: 500 });
  }
}
