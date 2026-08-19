import { NextResponse } from 'next/server';
import { fetchOrganizationById, fetchEventsByOrg } from '@/data/lib/data';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { slug: string } }) {
  const organization = await fetchOrganizationById(params.slug);

  if (!organization) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }

  const events = await fetchEventsByOrg(params.slug);
  return NextResponse.json({ organization, events });
}
