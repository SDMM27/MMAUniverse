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
    <main className="flex min-h-screen flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent-strong">Calendrier MMA</p>
        <h1 className="font-display text-[clamp(2.5rem,7vw,5rem)] uppercase leading-[0.9] text-ink">Événements</h1>
      </header>
      {events.length === 0 ? <EmptyState title="Aucun événement pour le moment" /> : <EventsByStatus events={events} />}
    </main>
  );
}
