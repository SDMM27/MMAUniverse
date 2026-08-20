import { fetchAllEvents, fetchOrganizations } from '@/data/lib/data';
import { computeNextEventByOrg } from '@/data/lib/event-utils';
import OrganizationsList from '@/components/ui/organizations/organizations-list';
import EmptyState from '@/components/ui/shared/empty-state';

// Queries the DB on every request instead of at build time — Vercel's build
// step doesn't reliably have DATABASE_URL / DB access yet (see data/lib/db.ts).
export const dynamic = 'force-dynamic';

export default async function Page() {
  const [organizations, events] = await Promise.all([fetchOrganizations(), fetchAllEvents()]);

  if (organizations.length === 0) {
    return (
      <main className="flex min-h-screen flex-col gap-8 p-6">
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
    <main className="flex min-h-screen flex-col gap-8 p-6">
      <h1 className="font-display text-2xl uppercase tracking-wide text-ink-primary">
        Organisations ({organizations.length})
      </h1>
      <OrganizationsList organizations={organizationsWithActivity} />
    </main>
  );
}
