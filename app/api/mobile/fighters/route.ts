import { NextResponse } from 'next/server';
import { fetchAllFighters } from '@/data/lib/data';

// Required: @neondatabase/serverless issues queries as fetch() calls, which Next.js
// would otherwise cache as static route data.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const fighters = await fetchAllFighters();
    return NextResponse.json(fighters);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Failed to fetch fighters' }, { status: 500 });
  }
}
