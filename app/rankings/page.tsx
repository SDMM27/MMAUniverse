import { fetchRankedOrganizations, fetchRankingsByOrg } from '@/data/lib/data';
import RankingsList from '@/components/ui/rankings/rankings-list';
import SectionHeading from '@/components/ui/fx/section-heading';
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
      <main className="flex min-h-screen flex-col gap-8 p-4 sm:p-6">
        <EmptyState title="Aucun classement disponible pour le moment" />
      </main>
    );
  }

  const rankingsByOrg = await Promise.all(organizations.map((org) => fetchRankingsByOrg(String(org.id))));

  return (
    <main className="flex min-h-screen flex-col gap-8 p-4 sm:p-6">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent-strong">
          <span className="fx-live mr-2 inline-block h-2.5 w-2.5 rounded-full bg-accent align-middle" />
          Classements officiels
        </p>
        <h1 className="font-display uppercase leading-[0.9] text-[clamp(2.5rem,7vw,5rem)] text-ink">Rankings</h1>
      </header>
      {organizations.map((org, i) => (
        <section key={org.id} aria-labelledby={`org-${org.id}`}>
          <SectionHeading id={`org-${org.id}`} title={org.name} />
          <RankingsList rankings={rankingsByOrg[i]} />
        </section>
      ))}
    </main>
  );
}
