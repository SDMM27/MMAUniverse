import { fetchAllEvents, fetchOrganizations } from '@/data/lib/data';
import { computeNextEvent } from '@/data/lib/event-utils';
import NextEventHero from '@/components/ui/events/next-event-hero';
import OrganizationsList from '@/components/ui/organizations/organizations-list';
import EmptyState from '@/components/ui/shared/empty-state';

// Queries the DB on every request instead of at build time — Vercel's build
// step doesn't reliably have DATABASE_URL / DB access yet (see data/lib/db.ts).
export const dynamic = 'force-dynamic';

export default async function Page() {
  const [organizations, events] = await Promise.all([
    fetchOrganizations(),
    fetchAllEvents(),
  ]);
  const next = computeNextEvent(events);

  return (
    <main className="flex min-h-screen flex-col gap-8 p-6">
      {next ? (
        <NextEventHero event={next.event} isUpcoming={next.isUpcoming} />
      ) : (
        <EmptyState title="Aucun événement pour le moment" />
      )}
      <section>
        <h2 className="mb-4 font-display text-lg uppercase tracking-wide text-ink-primary">Organisations</h2>
        <OrganizationsList organizations={organizations} />
      </section>
    </main>
  );
}
