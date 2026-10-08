import { Event } from './definitions';

const EVENT_TIME_FORMATTER = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Paris',
});

const EVENT_DATE_FORMATTER = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const EVENT_DAY_FORMATTER = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/**
 * A scraped 'YYYY-MM-DD' date in French -- "10 oct. 2026", or "sam. 10 oct. 2026"
 * with `weekday`. Read in UTC so the calendar day never shifts. Anything that
 * isn't a plain ISO date is returned untouched.
 */
export function formatEventDate(date: string | null | undefined, { weekday = false } = {}): string {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return date ?? '';
  return (weekday ? EVENT_DAY_FORMATTER : EVENT_DATE_FORMATTER).format(new Date(`${date}T00:00:00Z`));
}

/**
 * An event name without Sherdog's redundant "<promotion> - " prefix:
 * "Professional Fighters League - PFL Tampa: Cyborg vs. Vieira" -> "PFL Tampa: Cyborg vs. Vieira",
 * "CW 209 - Cage Warriors 209: Newcastle" -> "Cage Warriors 209: Newcastle".
 *
 * The prefix only goes when the rest names the event on its own: either the
 * prefix is a bare promotion name (no number) and the rest isn't just a
 * matchup ("Bellator Champions Series London - McCourt vs. Collins" stays), or
 * the rest repeats the prefix's number. "UFC 331 - Van vs. Pantoja 2" stays.
 */
export function displayEventName(name: string): string {
  const clean = name.replace(/\s+/g, ' ').trim();
  const separator = clean.indexOf(' - ');
  if (separator === -1) return clean;
  const prefix = clean.slice(0, separator);
  const rest = clean.slice(separator + 3);
  const prefixNumber = prefix.match(/\d+/)?.[0];
  if (!prefixNumber) {
    const titleBeforeMatchup = rest.indexOf(':') !== -1 && rest.indexOf(':') < rest.indexOf(' vs. ');
    return !rest.includes(' vs. ') || titleBeforeMatchup ? rest : clean;
  }
  return new RegExp(`\\b${prefixNumber}\\b`).test(rest) ? rest : clean;
}

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

// UFC is the most-followed organization and gets priority placement on the
// home page (hero selection here, and result ordering in
// fetchRecentFinishedFights in data.ts, which imports this constant rather
// than repeating the literal). This is a hardcoded rule, not a generic
// popularity system — a real preference-based ranking (favorited
// orgs/fighters) needs user accounts, which don't exist yet (see
// docs/superpowers/specs/2026-08-20-home-editorial-redesign-design.md,
// Profile section).
export const PRIORITY_ORGANIZATION_ABBREVIATION = 'UFC';

/**
 * Home hero event selection: prefers the next upcoming UFC event over any
 * other organization's, even when another org's event is chronologically
 * sooner. Falls back to computeNextEvent's normal any-org behavior (soonest
 * upcoming event, or last past event if nothing is upcoming anywhere) when
 * there's no upcoming UFC event in `events`.
 *
 * Precondition: like computeNextEvent, this assumes `events` itself is
 * already date-ascending (true of events as fetched from the DB). The
 * `.sort()` below only re-establishes that ordering for the UFC-filtered
 * subset, which callers can't easily pre-sort themselves after filtering the
 * full list; it does not protect the `computeNextEvent(events)` fallback
 * branch, which trusts the caller's original ordering same as
 * computeNextEvent/computeNextEventByOrg do.
 */
export function computeNextEventForHome<T extends Event & { organization_abbreviation: string }>(
  events: T[],
): { event: T; isUpcoming: boolean } | null {
  // computeNextEvent expects date-ascending input (it takes the first match
  // rather than sorting) — true of events as fetched from the DB, but not
  // guaranteed once filtered down to just the priority org, so sort
  // explicitly rather than relying on the caller's original ordering.
  const priorityEvents = events
    .filter((event) => event.organization_abbreviation === PRIORITY_ORGANIZATION_ABBREVIATION)
    .sort((a, b) => a.date.localeCompare(b.date));
  const nextPriorityEvent = computeNextEvent(priorityEvents);

  if (nextPriorityEvent && nextPriorityEvent.isUpcoming) {
    return nextPriorityEvent;
  }

  return computeNextEvent(events);
}

/**
 * Stable-sorts `items` so every item whose `organization_abbreviation`
 * matches `priorityAbbreviation` comes before every item that doesn't,
 * preserving relative order within each group. Used to bubble UFC results
 * to the top of "Derniers résultats" without disturbing the date ordering
 * already applied upstream (Array.prototype.sort is a stable sort in
 * Node/V8, guaranteed by the spec since ES2019).
 */
export function prioritizeOrganization<T extends { organization_abbreviation: string }>(
  items: T[],
  priorityAbbreviation: string,
): T[] {
  const rank = (item: T) => (item.organization_abbreviation === priorityAbbreviation ? 0 : 1);
  return [...items].sort((a, b) => rank(a) - rank(b));
}

/**
 * Reduces `items` to one entry per `event_id`: the one with `is_main_event`
 * true, or — when no row for that event is flagged (older events never got
 * `is_main_event` backfilled) — the one with the lowest `id`. When more than
 * one row for the same event is flagged `is_main_event` (a data-quality
 * fluke observed in the DB, e.g. a card with two "semifinal" main events),
 * picks the lowest `id` among those flagged rows, for a deterministic
 * result. This is the same "is_main_event, else lowest id" convention
 * `fetchFightsByEvent`'s `ORDER BY is_main_event DESC, id ASC` and
 * `splitMainEvent` already use elsewhere — see
 * docs/superpowers/specs/2026-09-04-home-recent-results-headline-fight-design.md.
 *
 * Preserves the order of each event_id's first appearance in `items` —
 * callers that already sort by event date should keep that ordering by
 * feeding this function pre-sorted input.
 */
export function selectHeadlineFightPerEvent<T extends { event_id: number; id: number; is_main_event: boolean }>(
  items: T[],
): T[] {
  const byEvent = new Map<number, T>();
  const eventOrder: number[] = [];

  for (const item of items) {
    const current = byEvent.get(item.event_id);
    if (!current) {
      byEvent.set(item.event_id, item);
      eventOrder.push(item.event_id);
      continue;
    }

    const currentIsBetter = current.is_main_event === item.is_main_event ? current.id < item.id : current.is_main_event;
    if (!currentIsBetter) {
      byEvent.set(item.event_id, item);
    }
  }

  return eventOrder.map((eventId) => byEvent.get(eventId)!);
}
