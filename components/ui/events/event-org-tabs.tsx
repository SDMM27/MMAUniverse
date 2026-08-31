import Link from 'next/link';
import { Event } from '@/data/lib/definitions';

/**
 * Horizontal tab strip of an organization's events (Google's UFC schedule
 * panel is the reference), so a visitor already on one event can hop
 * sideways to another without going back through /events. Renders nothing
 * when the org has one event on file or fewer — a single-tab strip has
 * nothing to navigate to.
 */
export default function EventOrgTabs({ events, currentEventId }: { events: Event[]; currentEventId: number }) {
  if (events.length <= 1) {
    return null;
  }

  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <nav
      aria-label="Autres événements de cette organisation"
      className="flex gap-6 overflow-x-auto border-b border-base-border pb-3"
    >
      {sorted.map((event) => {
        const active = event.id === currentEventId;
        return (
          <Link
            key={event.id}
            href={`/events/${event.id}`}
            aria-current={active ? 'page' : undefined}
            className={`shrink-0 whitespace-nowrap font-display text-sm uppercase tracking-wide transition-colors ${
              active ? 'text-accent' : 'text-ink-secondary hover:text-accent'
            }`}
          >
            {event.name}
          </Link>
        );
      })}
    </nav>
  );
}
