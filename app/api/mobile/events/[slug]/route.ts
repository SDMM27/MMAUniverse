import { NextResponse } from 'next/server';
import { fetchEventById, fetchFightsByEvent } from '@/data/lib/data';

// Required: @neondatabase/serverless issues queries as fetch() calls, which Next.js
// would otherwise cache as static route data.
export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { slug: string } }) {
  try {
    const event = await fetchEventById(params.slug);

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const fights = await fetchFightsByEvent(params.slug);
    return NextResponse.json({ event, fights });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Failed to fetch event' }, { status: 500 });
  }
}
