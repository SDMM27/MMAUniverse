import Link from 'next/link';
import { Event } from '@/data/lib/definitions';
import { displayEventName } from '@/data/lib/event-utils';

// How many neighboring events to show on each side of the current one.
const WINDOW_RADIUS = 2;

/**
 * Horizontal tab strip of an organization's events (Google's UFC schedule
 * panel is the reference), so a visitor already on one event can hop
 * sideways to another without going back through /events. Renders nothing
 * when the org has one event on file or fewer — a single-tab strip has
 * nothing to navigate to.
 *
 * Windowed to the WINDOW_RADIUS events on either side of the current one
 * (so at most 5 tabs) rather than the org's full history — an org like the
 * UFC has hundreds of events on file, and the Google reference itself only
 * shows a couple of neighbors, not a scroll through every event since UFC 1.
 */
export default function EventOrgTabs({ events, currentEventId }: { events: Event[]; currentEventId: number }) {
  if (events.length <= 1) {
    return null;
  }

  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
  const currentIndex = sorted.findIndex((event) => event.id === currentEventId);
  const windowed = currentIndex === -1 ? sorted : sorted.slice(
    Math.max(0, currentIndex - WINDOW_RADIUS),
    currentIndex + WINDOW_RADIUS + 1,
  );

  if (windowed.length <= 1) {
    return null;
  }

  return (
    <nav
      aria-label="Autres événements de cette organisation"
      className="flex gap-6 overflow-x-auto border-b border-base-border pb-3"
    >
      {windowed.map((event) => {
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
            {displayEventName(event.name)}
          </Link>
        );
      })}
    </nav>
  );
}
