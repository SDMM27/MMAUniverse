import { NextResponse } from 'next/server';
import { fetchAllEvents } from '@/data/lib/data';

export const dynamic = 'force-dynamic';

export async function GET() {
  const events = await fetchAllEvents();
  return NextResponse.json(events);
}
