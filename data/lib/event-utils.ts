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

export function computeNextEvent<T extends Event & { organization_abbreviation: string }>(
  events: T[],
): { event: T; isUpcoming: boolean } | null {
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

/**
 * Per-organization version of computeNextEvent, plus a total count of events
 * on file for that org. Used on the home page so each organization card can
 * show what's actually coming up there instead of just its logo — useful now
 * that we track a dozen orgs whose logos are often indistinguishable
 * placeholders.
 */
export function computeNextEventByOrg<T extends Event & { organization_abbreviation: string }>(
  events: T[],
): Map<number, { event: T; isUpcoming: boolean; eventCount: number }> {
  const byOrg = new Map<number, T[]>();
  for (const event of events) {
    const list = byOrg.get(event.organization_id);
    if (list) {
      list.push(event);
    } else {
      byOrg.set(event.organization_id, [event]);
    }
  }

  const result = new Map<number, { event: T; isUpcoming: boolean; eventCount: number }>();
  for (const [orgId, orgEvents] of Array.from(byOrg.entries())) {
    const next = computeNextEvent(orgEvents);
    if (next) {
      result.set(orgId, { ...next, eventCount: orgEvents.length });
    }
  }
  return result;
}
