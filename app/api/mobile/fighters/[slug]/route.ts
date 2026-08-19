import { NextResponse } from 'next/server';
import { fetchFighterById, fetchFightsByFighterId } from '@/data/lib/data';
import { computeFighterStats } from '@/data/lib/fighter-stats';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { slug: string } }) {
  const fighter = await fetchFighterById(params.slug);

  if (!fighter) {
    return NextResponse.json({ error: 'Fighter not found' }, { status: 404 });
  }

  const fights = await fetchFightsByFighterId(params.slug);
  const stats = computeFighterStats(fights);
  return NextResponse.json({ fighter, fights, stats });
}
