import { displayEventName } from './event-utils';
import { fighterHref } from './slug';
import { SITE_NAME } from './seo-utils';

// Pure builders for the schema.org JSON-LD rendered by <JsonLd> (kept free of DB
// imports so they are testable). Every URL comes out absolute, built on `base`
// (getSiteUrl(), no trailing slash).

type JsonLdObject = Record<string, unknown>;

const isAbsoluteUrl = (value: string | null | undefined): value is string => Boolean(value && /^https?:\/\//i.test(value));

/** Drops undefined/null/empty-array fields so the output only states what is known. */
function compact(object: JsonLdObject): JsonLdObject {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined && value !== null && !(Array.isArray(value) && value.length === 0)),
  );
}

export function websiteJsonLd(base: string, description: string): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', '@id': `${base}/#website`, name: SITE_NAME, url: `${base}/`, description, inLanguage: 'fr-FR', publisher: { '@id': `${base}/#organization` } },
      { '@type': 'Organization', '@id': `${base}/#organization`, name: SITE_NAME, url: `${base}/`, logo: `${base}/logo-mma-universe.png` },
    ],
  };
}

/** `crumbs` are [label, path] pairs after "Accueil"; the last one is the current page. */
export function breadcrumbJsonLd(base: string, crumbs: Array<[string, string]>): JsonLdObject {
  const items: Array<[string, string]> = [['Accueil', '/'], ...crumbs];
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, path], index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name,
      item: path === '/' ? `${base}/` : `${base}${path}`,
    })),
  };
}

type EventInput = {
  id: number;
  name: string;
  date: string;
  start_time: string | null;
  main_card_start?: string | null;
  event_location?: string | null;
  event_poster?: string | null;
  organization_id: number;
  organization_abbreviation: string;
};

type FighterRef = { id: number; name: string | null } | null;

/**
 * The precise start when the event has one, else its calendar day. A time at
 * exactly 00:00 UTC is a placeholder for "time unknown" (see formatEventTime).
 */
function eventStartDate(event: EventInput): string {
  for (const value of [event.main_card_start, event.start_time]) {
    const parsed = value ? new Date(value) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) continue;
    if (parsed.getUTCHours() === 0 && parsed.getUTCMinutes() === 0 && parsed.getUTCSeconds() === 0) continue;
    return parsed.toISOString();
  }
  return event.date;
}

export function sportsEventJsonLd(
  base: string,
  event: EventInput,
  fights: Array<{ fighter1: FighterRef; fighter2: FighterRef }>,
  description: string,
): JsonLdObject {
  const competitors = new Map<string, JsonLdObject>();
  for (const fight of fights) {
    for (const fighter of [fight.fighter1, fight.fighter2]) {
      if (!fighter?.name) continue;
      const url = `${base}${fighterHref({ id: fighter.id, name: fighter.name })}`;
      competitors.set(url, { '@type': 'Person', name: fighter.name, url });
    }
  }
  return compact({
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: displayEventName(event.name),
    description,
    url: `${base}/events/${event.id}`,
    startDate: eventStartDate(event),
    sport: 'Mixed Martial Arts',
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    image: isAbsoluteUrl(event.event_poster) ? [event.event_poster] : undefined,
    location: event.event_location ? { '@type': 'Place', name: event.event_location, address: event.event_location } : undefined,
    organizer: {
      '@type': 'SportsOrganization',
      name: event.organization_abbreviation,
      url: `${base}/organizations/${event.organization_id}`,
    },
    competitor: Array.from(competitors.values()),
  });
}

type FighterInput = {
  name: string;
  image_url?: string | null;
  nationality?: string | null;
  height_cm?: number | null;
  birth_date?: Date | string | null;
  is_women?: boolean | null;
  organization_id: number;
  organization_abbreviation?: string | null;
};

// The DB driver hands a DATE column back at *local* midnight (see fighter-age.ts),
// so a Date is read with local getters; a 'YYYY-MM-DD' string is read as-is.
function isoDate(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : undefined;
  if (Number.isNaN(value.getTime())) return undefined;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

export function fighterProfileJsonLd(base: string, fighter: FighterInput, path: string, description: string): JsonLdObject {
  const url = `${base}${path}`;
  const person = compact({
    '@type': 'Person',
    '@id': `${url}#person`,
    name: fighter.name,
    url,
    description,
    image: isAbsoluteUrl(fighter.image_url) ? fighter.image_url : undefined,
    jobTitle: 'Combattant de MMA',
    gender: fighter.is_women === true ? 'https://schema.org/Female' : fighter.is_women === false ? 'https://schema.org/Male' : undefined,
    birthDate: isoDate(fighter.birth_date),
    nationality: fighter.nationality ? { '@type': 'Country', name: fighter.nationality.toUpperCase() } : undefined,
    height: fighter.height_cm ? { '@type': 'QuantitativeValue', value: fighter.height_cm, unitCode: 'CMT' } : undefined,
    memberOf: fighter.organization_abbreviation
      ? { '@type': 'SportsOrganization', name: fighter.organization_abbreviation, url: `${base}/organizations/${fighter.organization_id}` }
      : undefined,
  });
  return { '@context': 'https://schema.org', '@type': 'ProfilePage', url, inLanguage: 'fr-FR', mainEntity: person };
}

export function sportsOrganizationJsonLd(
  base: string,
  organization: { id: number; name: string; abbreviation?: string | null; logo_link?: string | null },
  description: string,
): JsonLdObject {
  return compact({
    '@context': 'https://schema.org',
    '@type': 'SportsOrganization',
    name: organization.name,
    alternateName: organization.abbreviation && organization.abbreviation !== organization.name ? organization.abbreviation : undefined,
    description,
    url: `${base}/organizations/${organization.id}`,
    logo: isAbsoluteUrl(organization.logo_link) ? organization.logo_link : undefined,
    sport: 'Mixed Martial Arts',
  });
}

/** JSON for a <script type="application/ld+json">: `<` escaped so no value can close the tag. */
export function serializeJsonLd(data: JsonLdObject | JsonLdObject[]): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
