import Link from 'next/link';
import { CoverImage } from '@/components/ui/shared/media';
import { Event, Fighter } from '@/data/lib/definitions';
import { formatEventTime } from '@/data/lib/event-utils';

export default function NextEventHero({
  event,
  isUpcoming,
  fighter1,
  fighter2,
}: {
  event: Event & { organization_abbreviation: string };
  isUpcoming: boolean;
  /** Main-event fighters, when known — used to build a fighter-vs-fighter hero
   *  visual instead of Sherdog's own event poster (see below). */
  fighter1?: Fighter | null;
  fighter2?: Fighter | null;
}) {
  // Sherdog doesn't have real event posters — every event, including numbered
  // PPVs, only exposes a tiny 200x100 auto-generated "vs" thumbnail, which
  // looks pixelated stretched across a full-width hero. The two fighters'
  // profile photos, on the other hand, can be requested at a much higher
  // resolution (see data/lib/image-utils.ts), so when we know both main-event
  // fighters we build the matchup visual ourselves instead of relying on
  // Sherdog's poster. Falls back to the poster when a fighter or its photo
  // is missing (e.g. a TBD opponent).
  const hasMatchup = Boolean(fighter1?.image_url && fighter2?.image_url);
  const eventTime = formatEventTime(event.main_card_start) ?? formatEventTime(event.start_time);

  return (
    <Link
      href={`/events/${event.id}`}
      className="relative flex min-h-[280px] flex-col justify-end overflow-hidden rounded-lg border border-base-border bg-base-card"
    >
      {hasMatchup ? (
        <div className="absolute inset-0 flex">
          {/* This box is far wider than it is tall, so only ~40% of the
              source portrait's height ever shows. `top` (0%) crops down to
              hairline only; centering the window a bit below the very top
              keeps the whole face (eyes through chin) in frame instead. */}
          <CoverImage
            src={fighter1!.image_url}
            alt={fighter1!.name}
            className="h-full w-1/2"
            sizes="50vw"
            objectPosition="50% 20%"
          />
          <CoverImage
            src={fighter2!.image_url}
            alt={fighter2!.name}
            className="h-full w-1/2"
            sizes="50vw"
            objectPosition="50% 20%"
          />
          <span
            aria-hidden="true"
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-display text-2xl italic text-white [text-shadow:0_2px_16px_rgba(0,0,0,0.85)] sm:text-4xl"
          >
            VS
          </span>
        </div>
      ) : (
        <CoverImage src={event.event_poster} alt={event.name} className="absolute inset-0 h-full w-full" />
      )}
      <div className="relative z-10 bg-gradient-to-t from-base-bg via-base-bg/80 to-transparent p-6">
        <span className="font-display text-xs uppercase tracking-wide text-accent">
          {isUpcoming ? 'Prochain événement' : 'Dernier événement'} · {event.organization_abbreviation}
        </span>
        <h1 className="mt-2 font-display text-3xl uppercase tracking-wide text-ink-primary">{event.name}</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          {event.date}
          {eventTime && ` · ${eventTime}`} · {event.event_location}
        </p>
      </div>
    </Link>
  );
}
