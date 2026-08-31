'use client';

import { Suspense } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { groupUpcomingByWeek, splitEventsByStatus } from '@/data/lib/event-utils';
import { Event } from '@/data/lib/definitions';
import EventCard from './event-card';

type Tab = 'upcoming' | 'past';

type Props<T extends Event> = {
  events: T[];
  emptyUpcoming?: string;
  emptyPast?: string;
};

/**
 * Renders a segmented À venir / Passés toggle above an event grid, instead of
 * stacking both groups — lets the visitor pick which one they care about.
 * Defaults to whichever group actually has events when the other is empty.
 *
 * The active tab lives in the `?status=` query param rather than local state:
 * this page unmounts when you navigate to an event (a different route
 * segment) and remounts fresh on browser back, so a plain useState silently
 * reset to the default tab on every back navigation. Reading it from the URL
 * survives that.
 */
function EventsByStatusInner<T extends Event>({
  events,
  emptyUpcoming = 'Aucun événement à venir pour le moment',
  emptyPast = 'Aucun événement passé',
}: Props<T>) {
  const { upcoming, past } = splitEventsByStatus(events);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const defaultTab: Tab = upcoming.length === 0 && past.length > 0 ? 'past' : 'upcoming';
  const paramStatus = searchParams.get('status');
  const tab: Tab = paramStatus === 'upcoming' || paramStatus === 'past' ? paramStatus : defaultTab;

  function selectTab(next: Tab) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('status', next);
    // replace, not push: switching tabs shouldn't pile up its own back-stack
    // entries, it should just update where "back" from an event lands.
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const active = tab === 'upcoming' ? upcoming : past;
  const emptyMessage = tab === 'upcoming' ? emptyUpcoming : emptyPast;
  const { thisWeek, later } = tab === 'upcoming' ? groupUpcomingByWeek(upcoming) : { thisWeek: [], later: [] };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2" role="tablist" aria-label="Filtrer les événements">
        {(
          [
            ['upcoming', `À venir (${upcoming.length})`],
            ['past', `Passés (${past.length})`],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => selectTab(value)}
            className={`rounded-full border px-4 py-1.5 font-display text-sm uppercase tracking-wide transition-colors ${
              tab === value
                ? 'border-accent bg-accent text-white'
                : 'border-base-border bg-base-card text-ink-secondary hover:border-accent'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {active.length === 0 ? (
        <p className="text-sm text-ink-secondary">{emptyMessage}</p>
      ) : tab === 'upcoming' ? (
        <div className="flex flex-col gap-6">
          {thisWeek.length > 0 && <EventGroup title={`Cette semaine (${thisWeek.length})`} events={thisWeek} />}
          {later.length > 0 && <EventGroup title={`À venir (${later.length})`} events={later} />}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {active.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}

function EventGroup<T extends Event>({ title, events }: { title: string; events: T[] }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-display text-sm uppercase tracking-wide text-ink-secondary">{title}</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {events.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
}

// useSearchParams() requires a Suspense boundary — without it, Next.js opts
// the whole page out of static rendering at build time.
export default function EventsByStatus<T extends Event>(props: Props<T>) {
  return (
    <Suspense fallback={null}>
      <EventsByStatusInner {...props} />
    </Suspense>
  );
}
