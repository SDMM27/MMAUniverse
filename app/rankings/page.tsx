import { fetchRankedOrganizations, fetchRankingsByOrg } from '@/data/lib/data';
import RankingsList from '@/components/ui/rankings/rankings-list';
import EmptyState from '@/components/ui/shared/empty-state';
import type { Metadata } from 'next';
import { staticPageMetadata } from '@/data/lib/seo-utils';

// Queries the DB on every request instead of at build time — Vercel's build
// step doesn't reliably have DATABASE_URL / DB access yet (see data/lib/db.ts).
export const dynamic = 'force-dynamic';

export const metadata: Metadata = staticPageMetadata({
  title: 'Classements officiels',
  description: 'Les classements officiels des organisations MMA, catégorie de poids par catégorie de poids, champions compris.',
  path: '/rankings',
});

export default async function Page() {
  const organizations = await fetchRankedOrganizations();

  if (organizations.length === 0) {
    return (
      <main className="flex min-h-screen flex-col gap-8 p-6">
        <EmptyState title="Aucun classement disponible pour le moment" />
      </main>
    );
  }

  const rankingsByOrg = await Promise.all(organizations.map((org) => fetchRankingsByOrg(String(org.id))));

  return (
    <main className="flex min-h-screen flex-col gap-8 p-6">
      <h1 className="font-display text-2xl uppercase tracking-wide text-ink-primary">Rankings</h1>
      {organizations.map((org, i) => (
        <section key={org.id} className="flex flex-col gap-3">
          <h2 className="font-display text-lg uppercase tracking-wide text-accent">{org.name}</h2>
          <RankingsList rankings={rankingsByOrg[i]} />
        </section>
      ))}
    </main>
  );
}
