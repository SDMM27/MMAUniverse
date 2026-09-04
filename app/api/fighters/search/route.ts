import { fetchFighters } from '@/data/lib/data';

// Same reasoning as app/seed/route.ts: without this, @neondatabase/serverless's
// underlying fetch() calls can get swept into Next's Data Cache.
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get('q') ?? '').trim();

  if (!query) {
    return Response.json({ fighters: [] });
  }

  const { fighters } = await fetchFighters({ query, pageSize: 8 });
  return Response.json({ fighters });
}
