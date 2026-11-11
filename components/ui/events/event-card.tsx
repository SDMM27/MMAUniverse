import Link from 'next/link';
import { Event } from '@/data/lib/definitions';
import { displayEventName, formatEventDate, formatEventTime } from '@/data/lib/event-utils';

export default function EventCard({
  event,
}: {
  event: Event & { organization_abbreviation?: string };
}) {
  const eventTime = formatEventTime(event.main_card_start) ?? formatEventTime(event.start_time);

  return (
    <Link
      href={`/events/${event.id}`}
      className="fx-card fx-notch flex min-w-0 flex-col overflow-hidden border border-line bg-surface hover:border-accent"
    >
      <div className="flex flex-col gap-2 p-3 sm:p-4">
        {event.organization_abbreviation && (
          <span className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent-strong">
            {event.organization_abbreviation}
          </span>
        )}
        <p className="font-display text-xl uppercase leading-[0.95] text-ink [overflow-wrap:anywhere]">{displayEventName(event.name)}</p>
        <p className="font-mono text-[11px] uppercase text-muted">
          {formatEventDate(event.date, { weekday: true })}
          {eventTime && ` · ${eventTime}`} · {event.event_location}
        </p>
      </div>
    </Link>
  );
}
