import { NextResponse } from 'next/server';
import { fetchOrganizationById, fetchEventsByOrg } from '@/data/lib/data';

// Required: @neondatabase/serverless issues queries as fetch() calls, which Next.js
// would otherwise cache as static route data.
export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { slug: string } }) {
  try {
    const organization = await fetchOrganizationById(params.slug);

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const events = await fetchEventsByOrg(params.slug);
    return NextResponse.json({ organization, events });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Failed to fetch organization' }, { status: 500 });
  }
}
