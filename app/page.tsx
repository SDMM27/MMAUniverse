import Link from 'next/link';
import { fetchAllEvents, fetchOrganizations } from '@/data/lib/data';
import { computeNextEvent, computeNextEventByOrg, splitEventsByStatus } from '@/data/lib/event-utils';
import NextEventHero from '@/components/ui/events/next-event-hero';
import EventCard from '@/components/ui/events/event-card';
import OrganizationsList from '@/components/ui/organizations/organizations-list';
import EmptyState from '@/components/ui/shared/empty-state';

// Queries the DB on every request instead of at build time — Vercel's build
// step doesn't reliably have DATABASE_URL / DB access yet (see data/lib/db.ts).
export const dynamic = 'force-dynamic';

const UPCOMING_PREVIEW_COUNT = 6;

export default async function Page() {
  const [organizations, events] = await Promise.all([
    fetchOrganizations(),
    fetchAllEvents(),
  ]);
  const next = computeNextEvent(events);
  const nextByOrg = computeNextEventByOrg(events);

  // The hero already covers the single most imminent event, so the "coming
  // up" strip below it shows what's next after that one — otherwise, with a
  // dozen orgs now feeding events in, the same fight card would appear twice
  // right on top of itself.
  const { upcoming } = splitEventsByStatus(events);
  const upcomingPreview = (next?.isUpcoming ? upcoming.slice(1) : upcoming).slice(0, UPCOMING_PREVIEW_COUNT);

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
      {next ? (
        <NextEventHero event={next.event} isUpcoming={next.isUpcoming} />
      ) : (
        <EmptyState title="Aucun événement pour le moment" />
      )}

      {upcomingPreview.length > 0 && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg uppercase tracking-wide text-ink-primary">À venir</h2>
            <Link href="/events" className="text-xs uppercase tracking-wide text-accent hover:underline">
              Voir tous les événements
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {upcomingPreview.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-4 font-display text-lg uppercase tracking-wide text-ink-primary">
          Organisations ({organizations.length})
        </h2>
        <OrganizationsList organizations={organizationsWithActivity} />
      </section>
    </main>
  );
}
