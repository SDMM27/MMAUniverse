// data/lib/rating/order-division.ts
import type { FighterRatingWithFighter } from '../definitions';

export type WeightClassRatingGroup = {
  weightClass: string;
  fighters: FighterRatingWithFighter[];
};

/**
 * Buckets a flat `fighter_ratings` list by weight_class, preserving the
 * order weight classes first appear in (the query orders by weight_class
 * already, so this is effectively alphabetical) rather than re-sorting --
 * mirrors groupRankingsByWeightClass's shape (data/lib/ranking-utils.ts) for
 * the official-rankings page, but standalone: FighterRatingWithFighter has
 * no `rank` field to split a champion out by (that's orderDivisionWithChampionPinned's
 * job, applied per group by the caller), so this is pure bucketing.
 */
export function groupFighterRatingsByWeightClass(ratings: FighterRatingWithFighter[]): WeightClassRatingGroup[] {
  const groups = new Map<string, WeightClassRatingGroup>();
  for (const rating of ratings) {
    let group = groups.get(rating.weight_class);
    if (!group) {
      group = { weightClass: rating.weight_class, fighters: [] };
      groups.set(rating.weight_class, group);
    }
    group.fighters.push(rating);
  }
  return Array.from(groups.values());
}

export type OrderedDivision = {
  fighters: FighterRatingWithFighter[];
  championOutranked: boolean;
};

/**
 * Orders a division's computed FightScore rows for display: the champion
 * (is_champion === true) is always pinned to index 0 regardless of their
 * own display_score -- an editorial choice (the belt is a sporting fact,
 * not just an algorithmic opinion), not an artifact of the ranking math,
 * see docs/superpowers/specs/2026-09-14-fighter-rating-algorithm-design.md's
 * "Position du champion" section -- with the rest of the division following
 * in display_score descending order from index 1. `championOutranked` is
 * true when the champion's display_score isn't actually the division's
 * highest among the rows given -- the caller uses that to show the
 * asterisk + explanatory text from the design spec.
 *
 * A no-op re-sort (plain display_score descending, championOutranked:
 * false) when no row has is_champion true -- nothing to pin yet (e.g. a
 * newly-crowned champion not yet matched/rated). If more than one row
 * somehow has is_champion true (shouldn't happen -- rankings only ever has
 * one rank-0 row per division), the first one encountered is treated as the
 * champion and the rest sort normally among themselves.
 */
// fighter_ratings.display_score is a Postgres NUMERIC column, which
// @neondatabase/serverless returns as a **string** at runtime (to avoid
// float-precision loss), not the `number` FighterRating's type declares --
// same well-known driver quirk this codebase already documents for
// BIGSERIAL ids (see PickemUser.id's comment in definitions.ts), just not
// previously hit for a NUMERIC column. `b.display_score - a.display_score`
// happens to sort correctly regardless (JS coerces both sides to numbers
// for `-`), which is why this bug shipped unnoticed -- but `>` does NOT
// coerce: comparing two strings with `>` is lexicographic ("99.0" > "100.0"
// is true as strings, backwards from the numeric truth), which silently
// inverted the asterisk in both directions (confirmed live on
// /classement-calcule: Bantamweight's champion, genuinely #1, wrongly
// showed the asterisk; Featherweight's champion, genuinely outranked,
// wrongly showed none). Every comparison below coerces explicitly with
// Number(...) rather than relying on operator-specific coercion.
function toNumber(displayScore: FighterRatingWithFighter['display_score']): number {
  return Number(displayScore);
}

export function orderDivisionWithChampionPinned(fighters: FighterRatingWithFighter[]): OrderedDivision {
  const championIndex = fighters.findIndex((f) => f.is_champion);
  if (championIndex === -1) {
    return {
      fighters: [...fighters].sort((a, b) => toNumber(b.display_score) - toNumber(a.display_score)),
      championOutranked: false,
    };
  }

  const champion = fighters[championIndex];
  const rest = fighters
    .filter((_, i) => i !== championIndex)
    .sort((a, b) => toNumber(b.display_score) - toNumber(a.display_score));
  const championOutranked = rest.length > 0 && toNumber(rest[0].display_score) > toNumber(champion.display_score);

  return { fighters: [champion, ...rest], championOutranked };
}
