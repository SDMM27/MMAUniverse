import { Event } from './definitions';

/**
 * Splits events into upcoming (date >= today, soonest first) and past
 * (date < today, most recent first) groups.
 */
export function splitEventsByStatus<T extends Event>(
  events: T[],
): { upcoming: T[]; past: T[] } {
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = events.filter((event) => event.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past = events.filter((event) => event.date < today).sort((a, b) => b.date.localeCompare(a.date));
  return { upcoming, past };
}

export function computeNextEvent(
  events: Array<Event & { organization_abbreviation: string }>,
): { event: Event & { organization_abbreviation: string }; isUpcoming: boolean } | null {
  if (events.length === 0) {
    return null;
  }

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = events.find((event) => event.date >= today);

  if (upcoming) {
    return { event: upcoming, isUpcoming: true };
  }

  return { event: events[events.length - 1], isUpcoming: false };
}
