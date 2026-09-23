import { NextResponse } from 'next/server';
import { fetchFighterById, fetchFighterFightHistory } from '@/data/lib/data';
import { computeFighterStats } from '@/data/lib/fighter-stats';
import { ageFromBirthDate } from '@/data/lib/fighter-age';

// Required: @neondatabase/serverless issues queries as fetch() calls, which Next.js
// would otherwise cache as static route data.
export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { slug: string } }) {
  try {
    const fighter = await fetchFighterById(params.slug);

    if (!fighter) {
      return NextResponse.json({ error: 'Fighter not found' }, { status: 404 });
    }

    const fights = await fetchFighterFightHistory(params.slug);
    const stats = computeFighterStats(fights);
    // Age computed here rather than on the phone: birth_date comes out of the DB
    // driver as a Date at the server's local midnight, which JSON would turn into
    // an ISO timestamp that can land on the previous day.
    const age = ageFromBirthDate(fighter.birth_date);
    return NextResponse.json({ fighter: { ...fighter, age }, fights, stats });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Failed to fetch fighter' }, { status: 500 });
  }
}
