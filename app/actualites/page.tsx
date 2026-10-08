import { fetchNewsArticles, fetchOrganizations } from '@/data/lib/data';
import NewsCard from '@/components/ui/news/news-card';
import NewsOrgFilter from '@/components/ui/news/news-org-filter';
import NewsPagination from '@/components/ui/news/news-pagination';
import EmptyState from '@/components/ui/shared/empty-state';
import type { Metadata } from 'next';

// Queries the DB on every request instead of at build time — Vercel's build
// step doesn't reliably have DATABASE_URL / DB access yet (see data/lib/db.ts).
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Actualités MMA',
  description: 'Les dernières actualités du MMA, filtrables par organisation.',
};

const PAGE_SIZE = 20;

export default async function ActualitesPage({
  searchParams,
}: {
  searchParams: { org?: string; page?: string };
}) {
  const organizationId =
    searchParams.org && searchParams.org !== 'all' && !Number.isNaN(Number(searchParams.org))
      ? Number(searchParams.org)
      : null;
  const page = Math.max(1, Number(searchParams.page) || 1);

  const [{ articles, total }, organizations] = await Promise.all([
    fetchNewsArticles({ organizationId, page, pageSize: PAGE_SIZE }),
    fetchOrganizations(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="flex min-h-screen flex-col gap-6 p-6">
      <h1 className="font-display text-2xl uppercase tracking-wide text-ink-primary">Actualités</h1>
      <NewsOrgFilter organizations={organizations} />
      {articles.length === 0 ? (
        <EmptyState
          title="Aucune actu pour le moment"
          description="Notre flux se met à jour automatiquement toutes les 20 minutes — reviens un peu plus tard."
        />
      ) : (
        <>
          <p className="text-xs text-ink-secondary">
            {total} actu{total > 1 ? 's' : ''}
          </p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {articles.map((article) => (
              <NewsCard key={article.id} article={article} />
            ))}
          </div>
        </>
      )}
      <NewsPagination page={page} totalPages={totalPages} organizationId={searchParams.org} />
    </main>
  );
}
