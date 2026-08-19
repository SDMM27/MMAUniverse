import { NextResponse } from 'next/server';
import { fetchAllEvents, fetchOrganizations } from '@/data/lib/data';
import { computeNextEvent } from '@/data/lib/event-utils';

// Required: @neondatabase/serverless issues queries as fetch() calls, which Next.js
// would otherwise cache as static route data.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [events, organizations] = await Promise.all([fetchAllEvents(), fetchOrganizations()]);
    const nextEvent = computeNextEvent(events);
    return NextResponse.json({ nextEvent, organizations });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Failed to fetch home data' }, { status: 500 });
  }
}
