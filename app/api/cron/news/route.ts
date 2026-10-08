// app/api/cron/news/route.ts
import { NextResponse } from 'next/server';
import { ingestAllSources } from '@/data/news/fetch-news';

// Without this (see data/lib/db.ts), @neondatabase/serverless's
// underlying fetch() calls can get swept into Next's Data Cache.
export const dynamic = 'force-dynamic';

// News ingestion is actually scheduled via GitHub Actions (see
// .github/workflows/news-sync.yml + data/news/run-ingest.ts), not Vercel
// Cron — Vercel Cron's frequency is limited on non-Pro plans, which the
// */20-minute cadence this feature needs would very likely have exceeded.
// This route is kept as a manually-triggerable HTTP endpoint (e.g. an admin
// "refresh now" action later, or ad-hoc debugging via curl in production).
// Nothing sets CRON_SECRET automatically for this route anymore (that only
// happens for a route Vercel itself schedules, and this one no longer is) —
// if you want this endpoint gated in production, set CRON_SECRET manually
// as a project env var and send it as `Authorization: Bearer <secret>`.
// Unset (the default now), any request is allowed.
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
    // failing) would otherwise still report HTTP 200. Surface that case as a
    // non-2xx instead, for whoever's polling/curling this endpoint (monitoring,
    // an admin tool, manual debugging) — independent of who's calling it.
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
