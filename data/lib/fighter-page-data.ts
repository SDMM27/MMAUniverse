import { cache } from 'react';
import { fetchFighterById, fetchFighterRatingsByFighterId } from '@/data/lib/data';
import { legacyRedirectSlug } from '@/data/lib/fighter-redirect';
import { fetchFighterBySlug } from '@/data/lib/fighter-slug-data';
import { isNumericSlug, slugify } from '@/data/lib/slug';

// Shared by the fighter page, its generateMetadata and its opengraph-image:
// React's cache() dedupes the calls made while rendering one request, so the
// fighter is fetched once even though several entry points need it.

export const getFighterRatings = cache((fighterId: string) => fetchFighterRatingsByFighterId(fighterId));

export type FighterRoute =
  | { kind: 'notFound' }
  // Legacy/odd URL: send the visitor to this canonical path.
  | { kind: 'redirect'; to: string }
  | { kind: 'found'; fighter: NonNullable<Awaited<ReturnType<typeof fetchFighterById>>>; canonicalPath: string };

const MAX_ID_DIGITS = 9;

function decodeSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Resolves the `[slug]` URL segment of /fighters/[slug].
 *  - "/fighters/islam-makhachev": looked up by slug (best row, see fetchFighterBySlug).
 *    A non-canonical spelling ("Islam-Makhachev") redirects to the lowercase slug.
 *  - "/fighters/11" (legacy): looked up by id, then redirected to the slug URL, but
 *    only when that slug leads back to the same person (same row, or a sibling row of
 *    the same fighter). Otherwise (homonyms, non-Latin names) the numeric URL is
 *    served as is, and is its own canonical. A slug URL never redirects to a numeric
 *    one, so there is no loop.
 */
export const resolveFighterRoute = cache(async (segment: string): Promise<FighterRoute> => {
  const raw = decodeSegment(segment);

  if (isNumericSlug(raw)) {
    if (raw.length > MAX_ID_DIGITS) return { kind: 'notFound' }; // would overflow the INT id column
    const fighter = await fetchFighterById(raw);
    if (!fighter) return { kind: 'notFound' };
    const slug = await legacyRedirectSlug(fighter);
    if (slug) return { kind: 'redirect', to: `/fighters/${slug}` };
    return { kind: 'found', fighter, canonicalPath: `/fighters/${fighter.id}` };
  }

  const slug = slugify(raw);
  if (!slug || isNumericSlug(slug)) return { kind: 'notFound' };
  if (slug !== raw) return { kind: 'redirect', to: `/fighters/${slug}` };
  const fighter = await fetchFighterBySlug(slug);
  if (!fighter) return { kind: 'notFound' };
  return { kind: 'found', fighter, canonicalPath: `/fighters/${slug}` };
});
