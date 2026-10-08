// Pure helpers for the global search (menu). No DB / React here so they stay unit-testable.

export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_MAX_LENGTH = 80;

export type SearchFighter = {
  id: number;
  name: string;
  image_url: string | null;
  nationality: string | null;
  weight_class: string | null;
  record: string | null;
  organization_abbreviation: string;
};

export type SearchEvent = {
  id: number;
  name: string;
  date: string;
  event_poster: string | null;
  organization_abbreviation: string | null;
};

export type SearchOrganization = {
  id: number;
  name: string;
  abbreviation: string;
  logo_link: string;
};

export type SearchResults = {
  fighters: SearchFighter[];
  events: SearchEvent[];
  organizations: SearchOrganization[];
};

export const EMPTY_SEARCH_RESULTS: SearchResults = { fighters: [], events: [], organizations: [] };

/**
 * Trims, collapses whitespace and caps the length. Returns null when the query is too short
 * to be worth a database round trip.
 */
export function normalizeSearchQuery(raw: string | null | undefined): string | null {
  const clean = (raw ?? '').replace(/\s+/g, ' ').trim().slice(0, SEARCH_MAX_LENGTH).trim();
  return clean.length >= SEARCH_MIN_LENGTH ? clean : null;
}

/** Escapes ILIKE wildcards (and the escape character itself, Postgres' default is a backslash). */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export function containsPattern(query: string): string {
  return `%${escapeLikePattern(query)}%`;
}

export function prefixPattern(query: string): string {
  return `${escapeLikePattern(query)}%`;
}

// Single place building the links of the search results (fighter links are meant to move to
// readable slugs later: only this function has to change).
export function fighterHref(fighter: Pick<SearchFighter, 'id'>): string {
  return `/fighters/${fighter.id}`;
}

export function eventHref(event: Pick<SearchEvent, 'id'>): string {
  return `/events/${event.id}`;
}

export function organizationHref(organization: Pick<SearchOrganization, 'id'>): string {
  return `/organizations/${organization.id}`;
}

// The /fighters page reads its search text from the `q` param.
export function allFightersHref(query: string): string {
  return `/fighters?q=${encodeURIComponent(query)}`;
}

export type SearchItem = {
  key: string;
  kind: 'fighter' | 'event' | 'organization';
  href: string;
};

/** Flat, display-ordered list (fighters, events, organizations) used for keyboard navigation. */
export function flattenResults(results: SearchResults): SearchItem[] {
  return [
    ...results.fighters.map((f) => ({ key: `fighter-${f.id}`, kind: 'fighter' as const, href: fighterHref(f) })),
    ...results.events.map((e) => ({ key: `event-${e.id}`, kind: 'event' as const, href: eventHref(e) })),
    ...results.organizations.map((o) => ({
      key: `organization-${o.id}`,
      kind: 'organization' as const,
      href: organizationHref(o),
    })),
  ];
}

/** Next active index for an arrow key press, wrapping around; -1 means "nothing active". */
export function moveActiveIndex(current: number, delta: 1 | -1, count: number): number {
  if (count <= 0) return -1;
  if (current < 0) return delta === 1 ? 0 : count - 1;
  return (current + delta + count) % count;
}
