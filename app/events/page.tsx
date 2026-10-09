import { fetchAllEvents } from '@/data/lib/data';
import EventsByStatus from '@/components/ui/events/events-by-status';
import EmptyState from '@/components/ui/shared/empty-state';
import type { Metadata } from 'next';
import { staticPageMetadata } from '@/data/lib/seo-utils';

// Queries the DB on every request instead of at build time — Vercel's build
// step doesn't reliably have DATABASE_URL / DB access yet (see data/lib/db.ts).
export const dynamic = 'force-dynamic';

export const metadata: Metadata = staticPageMetadata({
  title: 'Événements MMA',
  description: 'Tous les événements MMA à venir et passés : UFC, PFL, Bellator, ONE et plus. Cards complètes, dates et lieux.',
  path: '/events',
});

export default async function Page() {
  const events = await fetchAllEvents();

  return (
    <main className="flex min-h-screen flex-col gap-6 p-6">
      <h1 className="font-display text-2xl uppercase tracking-wide text-ink-primary">Événements</h1>
      {events.length === 0 ? <EmptyState title="Aucun événement pour le moment" /> : <EventsByStatus events={events} />}
    </main>
  );
}
