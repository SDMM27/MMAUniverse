import { fetchAllEvents } from '@/data/lib/data';
import { splitEventsByStatus } from '@/data/lib/event-utils';
import EventCard from '@/components/ui/events/event-card';
import EmptyState from '@/components/ui/shared/empty-state';

// Queries the DB on every request instead of at build time — Vercel's build
// step doesn't reliably have DATABASE_URL / DB access yet (see data/lib/db.ts).
export const dynamic = 'force-dynamic';

export default async function Page() {
  const events = await fetchAllEvents();
  const { upcoming, past } = splitEventsByStatus(events);

  return (
    <main className="flex min-h-screen flex-col gap-8 p-6">
      <h1 className="font-display text-2xl uppercase tracking-wide text-ink-primary">Events</h1>
      {events.length === 0 ? (
        <EmptyState title="Aucun événement pour le moment" />
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="font-display text-lg uppercase tracking-wide text-ink-secondary">
              À venir
            </h2>
            {upcoming.length === 0 ? (
              <p className="text-sm text-ink-secondary">Aucun événement à venir pour le moment</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                {upcoming.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            )}
          </section>
          <section className="flex flex-col gap-3">
            <h2 className="font-display text-lg uppercase tracking-wide text-ink-secondary">
              Passés
            </h2>
            {past.length === 0 ? (
              <p className="text-sm text-ink-secondary">Aucun événement passé</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                {past.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
