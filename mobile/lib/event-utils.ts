import type { Event } from './types';

/**
 * Splits events into upcoming (date >= today, soonest first) and past
 * (date < today, most recent first) groups. Mirrors data/lib/event-utils.ts
 * on the web side — kept separate since the mobile app has no access to the
 * Next.js server code, only to the JSON it serves.
 */
export function splitEventsByStatus<T extends Event>(events: T[]): { upcoming: T[]; past: T[] } {
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = events.filter((event) => event.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past = events.filter((event) => event.date < today).sort((a, b) => b.date.localeCompare(a.date));
  return { upcoming, past };
}
