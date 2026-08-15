import Link from 'next/link';
import { CoverImage } from '@/components/ui/shared/media';
import { Event } from '@/data/lib/definitions';

export default function NextEventHero({
  event,
  isUpcoming,
}: {
  event: Event & { organization_abbreviation: string };
  isUpcoming: boolean;
}) {
  return (
    <Link
      href={`/events/${event.id}`}
      className="relative flex min-h-[280px] flex-col justify-end overflow-hidden rounded-lg border border-base-border"
    >
      <CoverImage src={event.event_poster} alt={event.name} className="absolute inset-0 h-full w-full" />
      <div className="relative z-10 bg-gradient-to-t from-base-bg via-base-bg/80 to-transparent p-6">
        <span className="font-display text-xs uppercase tracking-wide text-accent">
          {isUpcoming ? 'Prochain événement' : 'Dernier événement'} · {event.organization_abbreviation}
        </span>
        <h1 className="mt-2 font-display text-3xl uppercase tracking-wide text-ink-primary">{event.name}</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          {event.date} · {event.event_location}
        </p>
      </div>
    </Link>
  );
}
