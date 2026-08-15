import { fetchAllEvents } from '@/data/lib/data';
import EventCard from '@/components/ui/events/event-card';
import EmptyState from '@/components/ui/shared/empty-state';

export default async function Page() {
  const events = await fetchAllEvents();

  return (
    <main className="flex min-h-screen flex-col gap-6 p-6">
      <h1 className="font-display text-2xl uppercase tracking-wide text-ink-primary">Events</h1>
      {events.length === 0 ? (
        <EmptyState title="Aucun événement pour le moment" />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </main>
  );
}
