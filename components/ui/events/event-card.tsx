import Link from 'next/link';
import { CoverImage } from '@/components/ui/shared/media';
import { Event } from '@/data/lib/definitions';
import { formatEventTime } from '@/data/lib/event-utils';

export default function EventCard({
  event,
}: {
  event: Event & { organization_abbreviation?: string };
}) {
  const eventTime = formatEventTime(event.main_card_start) ?? formatEventTime(event.start_time);

  return (
    <Link
      href={`/events/${event.id}`}
      className="flex flex-col overflow-hidden rounded-lg border border-base-border bg-base-card transition-colors hover:border-accent"
    >
      <CoverImage src={event.event_poster} alt={event.name} className="aspect-video w-full" />
      <div className="flex flex-col gap-1 p-3">
        {event.organization_abbreviation && (
          <span className="font-display text-xs uppercase tracking-wide text-accent">
            {event.organization_abbreviation}
          </span>
        )}
        <p className="font-display text-sm uppercase tracking-wide text-ink-primary">{event.name}</p>
        <p className="text-xs text-ink-secondary">
          {event.date}
          {eventTime && ` · ${eventTime}`} · {event.event_location}
        </p>
      </div>
    </Link>
  );
}
