import { NextResponse } from 'next/server';
import { fetchAllEvents, fetchOrganizations, fetchFightsByEvent } from '@/data/lib/data';
import { computeNextEventForHome, groupUpcomingByWeek, splitEventsByStatus } from '@/data/lib/event-utils';

// Required: @neondatabase/serverless issues queries as fetch() calls, which Next.js
// would otherwise cache as static route data.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [events, organizations] = await Promise.all([fetchAllEvents(), fetchOrganizations()]);
    const nextEvent = computeNextEventForHome(events);
    const fights = nextEvent && nextEvent.isUpcoming ? await fetchFightsByEvent(String(nextEvent.event.id)) : [];

    // Same "this week, minus whatever's already the hero" set the web home
    // shows in its "Cette semaine" section (see app/page.tsx) — computed
    // here rather than on-device because the mobile app only ever sees
    // this route's JSON, not data/lib/event-utils.ts directly.
    const { upcoming } = splitEventsByStatus(events);
    const { thisWeek } = groupUpcomingByWeek(upcoming);
    const heroEventId = nextEvent && nextEvent.isUpcoming ? nextEvent.event.id : null;
    const weeklyEvents = thisWeek.filter((event) => event.id !== heroEventId);

    return NextResponse.json({ nextEvent, organizations, fights, weeklyEvents });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Failed to fetch home data' }, { status: 500 });
  }
}
