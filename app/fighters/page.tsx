import { fetchFighters, fetchOrganizations } from '@/data/lib/data';
import FightersGrid from '@/components/ui/fighters/fighters-grid';
import FightersSearchBar from '@/components/ui/fighters/fighters-search-bar';
import FightersPagination from '@/components/ui/fighters/fighters-pagination';
import EmptyState from '@/components/ui/shared/empty-state';
import type { Metadata } from 'next';
import { listingCanonical, staticPageMetadata } from '@/data/lib/seo-utils';

// Queries the DB on every request instead of at build time — Vercel's build
// step doesn't reliably have DATABASE_URL / DB access yet (see data/lib/db.ts).
export const dynamic = 'force-dynamic';

export function generateMetadata({ searchParams }: { searchParams: { q?: string; org?: string; page?: string } }): Metadata {
  const metadata = staticPageMetadata({
    title: 'Combattants MMA',
    description: 'Recherchez parmi les combattants MMA de toutes les organisations : bilan, catégorie de poids, nationalité et fiche détaillée.',
    path: listingCanonical('/fighters', searchParams),
  });
  // Search results are endless near-duplicates: crawl through them, don't index them.
  return searchParams.q?.trim() ? { ...metadata, robots: { index: false, follow: true } } : metadata;
}

const PAGE_SIZE = 24;

export default async function Page({
  searchParams,
}: {
  searchParams: { q?: string; org?: string; page?: string };
}) {
  const query = (searchParams.q ?? '').trim();
  const organizationId =
    searchParams.org && searchParams.org !== 'all' && !Number.isNaN(Number(searchParams.org))
      ? Number(searchParams.org)
      : null;
  const page = Math.max(1, Number(searchParams.page) || 1);

  const [{ fighters, total }, organizations] = await Promise.all([
    fetchFighters({ query, organizationId, page, pageSize: PAGE_SIZE }),
    fetchOrganizations(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="flex min-h-screen flex-col gap-6 shell py-4 sm:py-6">
      <header>
        <p className="mb-2 font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent-strong">
          <span className="fx-live mr-2 inline-block h-2.5 w-2.5 rounded-full bg-accent align-middle" />
          Toutes organisations
        </p>
        <h1 className="font-display uppercase leading-[0.9] text-[clamp(2.5rem,7vw,5rem)] text-ink">Combattants</h1>
      </header>
      <FightersSearchBar organizations={organizations} />
      {fighters.length === 0 ? (
        <EmptyState
          title={query ? `Aucun combattant ne correspond à « ${query} »` : 'Aucun combattant dans cette catégorie'}
        />
      ) : (
        <>
          <p className="font-mono text-[11px] uppercase text-muted">
            {total} combattant{total > 1 ? 's' : ''} trouvé{total > 1 ? 's' : ''}
          </p>
          <FightersGrid fighters={fighters} />
        </>
      )}
      <FightersPagination page={page} totalPages={totalPages} query={query} organizationId={searchParams.org} />
    </main>
  );
}
