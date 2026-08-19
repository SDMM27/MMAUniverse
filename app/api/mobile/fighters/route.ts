import { NextResponse } from 'next/server';
import { fetchAllFighters } from '@/data/lib/data';

export const dynamic = 'force-dynamic';

export async function GET() {
  const fighters = await fetchAllFighters();
  return NextResponse.json(fighters);
}
