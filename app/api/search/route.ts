// app/api/search/route.ts
import { searchEvents, searchFighters, searchOrganizations } from '@/data/lib/search-data';
import { EMPTY_SEARCH_RESULTS, normalizeSearchQuery } from '@/data/lib/search-utils';

// Same reasoning as app/seed/route.ts: without this, @neondatabase/serverless's
// underlying fetch() calls can get swept into Next's Data Cache.
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = normalizeSearchQuery(searchParams.get('q'));

  if (!query) {
    return Response.json(EMPTY_SEARCH_RESULTS);
  }

  try {
    const [fighters, events, organizations] = await Promise.all([
      searchFighters(query, 6),
      searchEvents(query, 4),
      searchOrganizations(query, 3),
    ]);
    return Response.json({ fighters, events, organizations });
  } catch (error) {
    console.error('API error:', error);
    return Response.json({ error: 'Erreur lors de la recherche.' }, { status: 500 });
  }
}
