import { NextResponse } from 'next/server';
import { fetchEventById, fetchFightsByEvent } from '@/data/lib/data';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { slug: string } }) {
  const event = await fetchEventById(params.slug);

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const fights = await fetchFightsByEvent(params.slug);
  return NextResponse.json({ event, fights });
}
