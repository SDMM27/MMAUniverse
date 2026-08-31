import { Event } from './definitions';

const EVENT_TIME_FORMATTER = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Paris',
});

/**
 * Formats an event's `start_time` (full ISO 8601 datetime, see
 * normalizeStartTime) as a French clock time in Europe/Paris — e.g. "20h00".
 *
 * Returns null both when start_time isn't known at all (events scraped
 * before that column existed) AND when it's exactly 00:00:00 UTC. The
 * latter isn't a real kickoff time: Sherdog's event page only exposes a
 * `startDate` meta tag, and when it doesn't have a confirmed broadcast time
 * yet it fills that tag with midnight UTC on the event's date rather than
 * omitting it — normalizeStartTime has no way to tell "confirmed midnight"
 * from "unknown", so we treat exact midnight as a placeholder. As of this
 * writing that's true for 57 of the 59 events with a non-null start_time in
 * the DB — showing it as a real time would (and did) read as "02h00" for a
 * card that actually starts at 18h/21h local.
 */
export function formatEventTime(startTime: string | null): string | null {
  if (!startTime) {
    return null;
  }
  const parsed = new Date(startTime);
  if (parsed.getUTCHours() === 0 && parsed.getUTCMinutes() === 0 && parsed.getUTCSeconds() === 0) {
    return null;
  }
  return EVENT_TIME_FORMATTER.format(parsed).replace(':', 'h');
}

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

/**
 * Splits an already-upcoming event list (soonest-first, from
 * splitEventsByStatus) into the current calendar week (through the coming
 * Sunday, Monday-start ISO week) and everything after — so /events can put
 * "cette semaine" front and center instead of dumping every future event
 * into one flat list.
 *
 * Uses UTC day-of-week to match splitEventsByStatus's UTC-based "today"
 * (toISOString().slice(0, 10)) — mixing local and UTC calendars here would
 * make the week boundary drift by up to a day from the upcoming/past split
 * it's built on top of.
 */
export function groupUpcomingByWeek<T extends Event>(upcoming: T[]): { thisWeek: T[]; later: T[] } {
  const now = new Date();
  const day = now.getUTCDay(); // 0 (Sun) .. 6 (Sat)
  const daysUntilSunday = day === 0 ? 0 : 7 - day;
  const endOfWeek = new Date(now);
  endOfWeek.setUTCDate(now.getUTCDate() + daysUntilSunday);
  const endOfWeekDate = endOfWeek.toISOString().slice(0, 10);

  const thisWeek = upcoming.filter((event) => event.date <= endOfWeekDate);
  const later = upcoming.filter((event) => event.date > endOfWeekDate);
  return { thisWeek, later };
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
 * on file for that org. Used by the /organizations list page so each
 * organization card can show what's actually coming up there instead of
 * just its logo.
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
