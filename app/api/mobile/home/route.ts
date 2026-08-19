import { NextResponse } from 'next/server';
import { fetchAllEvents, fetchOrganizations } from '@/data/lib/data';
import { computeNextEvent } from '@/data/lib/event-utils';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [events, organizations] = await Promise.all([fetchAllEvents(), fetchOrganizations()]);
  const nextEvent = computeNextEvent(events);
  return NextResponse.json({ nextEvent, organizations });
}
