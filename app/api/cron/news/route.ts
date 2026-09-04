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
