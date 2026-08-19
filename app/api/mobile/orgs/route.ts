import { NextResponse } from 'next/server';
import { fetchOrganizations } from '@/data/lib/data';

export const dynamic = 'force-dynamic';

export async function GET() {
  const organizations = await fetchOrganizations();
  return NextResponse.json(organizations);
}
