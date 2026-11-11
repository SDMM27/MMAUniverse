import { fetchNewsArticles, fetchOrganizations } from '@/data/lib/data';
import NewsCard from '@/components/ui/news/news-card';
import NewsOrgFilter from '@/components/ui/news/news-org-filter';
import NewsPagination from '@/components/ui/news/news-pagination';
import EmptyState from '@/components/ui/shared/empty-state';
import type { Metadata } from 'next';
import { listingCanonical, staticPageMetadata } from '@/data/lib/seo-utils';

// Queries the DB on every request instead of at build time — Vercel's build
// step doesn't reliably have DATABASE_URL / DB access yet (see data/lib/db.ts).
export const dynamic = 'force-dynamic';

export function generateMetadata({ searchParams }: { searchParams: { org?: string; page?: string } }): Metadata {
  return staticPageMetadata({
    title: 'Actualités MMA',
    description: "Les dernières actualités du MMA (UFC, PFL, Bellator, ONE et plus), filtrables par organisation.",
    path: listingCanonical('/actualites', searchParams),
  });
}

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
    <main className="flex min-h-screen flex-col gap-6 shell py-4 sm:py-6">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent-strong">
          <span className="fx-live mr-2 inline-block h-2.5 w-2.5 rounded-full bg-accent align-middle" />
          Fil d&apos;actus
        </p>
        <h1 className="font-display uppercase leading-[0.9] text-[clamp(2.5rem,7vw,5rem)] text-ink">Actualités</h1>
      </header>
      <NewsOrgFilter organizations={organizations} />
      {articles.length === 0 ? (
        <EmptyState
          title="Aucune actu pour le moment"
          description="Notre flux se met à jour automatiquement toutes les 20 minutes — reviens un peu plus tard."
        />
      ) : (
        <>
          <p className="font-mono text-[11px] uppercase text-muted">
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
