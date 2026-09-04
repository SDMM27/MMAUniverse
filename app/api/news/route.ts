// app/api/news/route.ts
import { NextResponse } from 'next/server';
import { fetchNewsArticles } from '@/data/lib/data';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgParam = searchParams.get('org');
    const organizationId = orgParam && !Number.isNaN(Number(orgParam)) ? Number(orgParam) : null;
    const page = Math.max(1, Number(searchParams.get('page')) || 1);

    const { articles, total } = await fetchNewsArticles({ organizationId, page, pageSize: PAGE_SIZE });
    return NextResponse.json({ articles, total, page, pageSize: PAGE_SIZE });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Failed to fetch news' }, { status: 500 });
  }
}
