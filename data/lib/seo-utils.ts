import { displayEventName, formatEventDate } from './event-utils';

// Pure helpers building the French meta descriptions (kept free of DB imports so they are testable).

/** Collapses whitespace and cuts at `max` characters (on a word boundary) with an ellipsis. */
export function truncateDescription(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.-]+$/, '')}…`;
}

export function fighterMetadataDescription(
  fighter: { name: string; weight_class?: string | null; record?: string | null; organization_abbreviation?: string | null },
  rating?: { display_score: string | number; weight_class?: string | null } | null,
): string {
  const parts: string[] = [];
  const context = [fighter.organization_abbreviation, fighter.weight_class].filter(Boolean).join(', ');
  parts.push(context ? `${fighter.name} (${context}).` : `${fighter.name}.`);
  if (fighter.record) parts.push(`Bilan : ${fighter.record}.`);
  if (rating && Number.isFinite(Number(rating.display_score))) {
    parts.push(`FightScore : ${Number(rating.display_score).toFixed(1)}/100.`);
  }
  parts.push('Historique des combats, statistiques et classements sur MMA Universe.');
  return truncateDescription(parts.join(' '), 200);
}

export function eventMetadataDescription(
  event: { name: string; date: string; event_location?: string | null; organization_abbreviation?: string | null },
  mainEvent?: { fighter1?: { name: string | null } | null; fighter2?: { name: string | null } | null } | null,
): string {
  const parts: string[] = [];
  const name = displayEventName(event.name);
  const date = formatEventDate(event.date);
  parts.push([name, date, event.event_location].filter(Boolean).join(' · ') + '.');
  const f1 = mainEvent?.fighter1?.name;
  const f2 = mainEvent?.fighter2?.name;
  if (f1 && f2) parts.push(`Main event : ${f1} vs ${f2}.`);
  parts.push('Card complète, résultats et pronostics.');
  return truncateDescription(parts.join(' '), 200);
}

export function organizationMetadataDescription(organization: { name: string; abbreviation?: string | null }): string {
  const label = organization.abbreviation && organization.abbreviation !== organization.name
    ? `${organization.name} (${organization.abbreviation})`
    : organization.name;
  return `${label} : prochains événements, résultats, classements officiels et combattants du roster.`;
}

export const SITE_NAME = 'MMA Universe';

// app/opengraph-image.png, served at this path. A page that sets its own `openGraph`
// replaces the root one entirely (Next merges metadata key by key), so it must
// carry this image back in itself or its shares go out without a picture.
export const DEFAULT_OG_IMAGE = { url: '/opengraph-image.png', width: 1200, height: 630, alt: SITE_NAME };

export const OPEN_GRAPH_BASE = { siteName: SITE_NAME, locale: 'fr_FR' } as const;

/**
 * Metadata for a public listing page: canonical URL plus an Open Graph block of
 * its own (title and description are filled in by Next from the page's).
 */
export function staticPageMetadata({ title, description, path }: { title: string; description: string; path: string }) {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { ...OPEN_GRAPH_BASE, type: 'website' as const, url: path, images: [DEFAULT_OG_IMAGE] },
  };
}

/**
 * Canonical path of a filterable, paginated listing (/fighters, /actualites):
 * keeps the organisation filter and a page past the first, drops everything else.
 */
export function listingCanonical(path: string, params: { org?: string; page?: string }): string {
  const query = new URLSearchParams();
  if (params.org && params.org !== 'all' && /^\d+$/.test(params.org)) query.set('org', params.org);
  const page = Number(params.page);
  if (Number.isInteger(page) && page > 1) query.set('page', String(page));
  const search = query.toString();
  return search ? `${path}?${search}` : path;
}
