import { Event } from './definitions';

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
