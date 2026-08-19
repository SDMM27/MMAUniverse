import { NextResponse } from 'next/server';
import { fetchOrganizations } from '@/data/lib/data';

// Required: @neondatabase/serverless issues queries as fetch() calls, which Next.js
// would otherwise cache as static route data.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const organizations = await fetchOrganizations();
    return NextResponse.json(organizations);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Failed to fetch organizations' }, { status: 500 });
  }
}
