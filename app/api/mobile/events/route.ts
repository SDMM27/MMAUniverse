import { NextResponse } from 'next/server';
import { fetchAllEvents } from '@/data/lib/data';

// Required: @neondatabase/serverless issues queries as fetch() calls, which Next.js
// would otherwise cache as static route data.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const events = await fetchAllEvents();
    return NextResponse.json(events);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}
