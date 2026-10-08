import type { MetadataRoute } from 'next';
import { unstable_cache } from 'next/cache';
import { fetchAllEvents, fetchOrganizations } from '@/data/lib/data';
import { fetchSitemapFighters } from '@/data/lib/fighter-slug-data';
import { fighterHref } from '@/data/lib/slug';
import { getSiteUrl } from '@/data/lib/site-url';

// Rendered at request time (never at build, where the database may be unreachable),
// then kept for a day by unstable_cache below.
export const dynamic = 'force-dynamic';

const MAX_URLS = 49000;

const STATIC_PATHS = [
  '/',
  '/events',
  '/fighters',
  '/organizations',
  '/rankings',
  '/classement-calcule',
  '/classement-calcule/methodologie',
  '/classement',
  '/actualites',
  '/analyses',
  '/simulateur',
];

// Events are stored with a 'YYYY-MM-DD' date; a past one is a fair "last modified".
function pastDate(value: string | null | undefined, today: string): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value > today) return undefined;
  return new Date(`${value}T00:00:00Z`);
}

const loadDynamicEntries = unstable_cache(
  async () => {
    const [events, organizations, fighters] = await Promise.all([
      fetchAllEvents(),
      fetchOrganizations(),
      fetchSitemapFighters(),
    ]);
    const today = new Date().toISOString().slice(0, 10);
    const seen = new Set<string>();
    const fighterPaths: Array<{ path: string; lastModified: string | null }> = [];
    for (const fighter of fighters) {
      const path = fighterHref(fighter);
      if (seen.has(path)) continue; // homonyms resolve to the same page
      seen.add(path);
      fighterPaths.push({ path, lastModified: pastDate(fighter.last_date, today)?.toISOString() ?? null });
    }
    return {
      events: events.map((event) => ({
        path: `/events/${event.id}`,
        lastModified: pastDate(event.date, today)?.toISOString() ?? null,
      })),
      organizations: organizations.map((organization) => `/organizations/${organization.id}`),
      fighters: fighterPaths,
    };
  },
  ['sitemap-dynamic-entries'],
  { revalidate: 86400 },
);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  const entries: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({ url: path === '/' ? base : `${base}${path}` }));

  try {
    const { events, organizations, fighters } = await loadDynamicEntries();
    for (const event of events) {
      entries.push({ url: `${base}${event.path}`, lastModified: event.lastModified ? new Date(event.lastModified) : undefined });
    }
    for (const path of organizations) entries.push({ url: `${base}${path}` });
    // Sitemap protocol limit: 50,000 URLs per file (fighters come most relevant first).
    const room = Math.max(0, MAX_URLS - entries.length);
    for (const fighter of fighters.slice(0, room)) {
      entries.push({ url: `${base}${fighter.path}`, lastModified: fighter.lastModified ? new Date(fighter.lastModified) : undefined });
    }
  } catch (error) {
    // Database unreachable: still serve the static pages rather than a 500.
    console.error('Sitemap: dynamic entries unavailable', error);
  }

  return entries;
}
