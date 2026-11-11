import { fetchAllEvents, fetchOrganizations } from '@/data/lib/data';
import { computeNextEventByOrg } from '@/data/lib/event-utils';
import OrganizationsList from '@/components/ui/organizations/organizations-list';
import EmptyState from '@/components/ui/shared/empty-state';
import type { Metadata } from 'next';
import { staticPageMetadata } from '@/data/lib/seo-utils';

// Queries the DB on every request instead of at build time — Vercel's build
// step doesn't reliably have DATABASE_URL / DB access yet (see data/lib/db.ts).
export const dynamic = 'force-dynamic';

export const metadata: Metadata = staticPageMetadata({
  title: 'Organisations MMA',
  description: 'Les organisations de MMA suivies sur MMA Universe : prochains événements, classements officiels et rosters.',
  path: '/organizations',
});

export default async function Page() {
  const [organizations, events] = await Promise.all([fetchOrganizations(), fetchAllEvents()]);

  if (organizations.length === 0) {
    return (
      <main className="flex min-h-screen flex-col gap-8 p-4 sm:p-6">
        <EmptyState title="Aucune organisation pour le moment" />
      </main>
    );
  }

  const nextByOrg = computeNextEventByOrg(events);

  const organizationsWithActivity = organizations.map((organization) => {
    const orgNext = nextByOrg.get(organization.id);
    return {
      ...organization,
      nextEvent: orgNext ? { ...orgNext.event, isUpcoming: orgNext.isUpcoming } : undefined,
      eventCount: orgNext?.eventCount ?? 0,
    };
  });

  return (
    <main className="flex min-h-screen flex-col gap-8 p-4 sm:p-6">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent-strong">
          <span className="fx-live mr-2 inline-block h-2.5 w-2.5 rounded-full bg-accent align-middle" />
          Les promotions suivies
        </p>
        <h1 className="font-display uppercase leading-[0.9] text-[clamp(2.5rem,7vw,5rem)] text-ink">Organisations ({organizations.length})</h1>
      </header>
      <OrganizationsList organizations={organizationsWithActivity} />
    </main>
  );
}
