// data/lib/rating/weekly-trend.ts
//
// Week-over-week movement on the FightScore lists. Each weekly recompute
// (data/scripts/compute-fighter-ratings.ts) snapshots every list's ranks into
// fighter_rating_snapshots under the Monday of its week; the lists compare
// today's position with the most recent snapshot from an EARLIER week, so a
// manual rerun mid-week overwrites this week's snapshot but never moves the
// baseline. Pure functions, no DB access.

/** Snapshot `list` value for the pound-for-pound lists (divisions use their weight_class). */
export function poundForPoundList(women: boolean): string {
  return women ? "Women's P4P" : 'P4P';
}

/** The Monday (UTC) of the week containing `dateIso` (YYYY-MM-DD), as YYYY-MM-DD. */
export function weekStartIso(dateIso: string): string {
  const date = new Date(`${dateIso}T00:00:00Z`);
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return date.toISOString().slice(0, 10);
}

export type RankTrend = { kind: 'none' } | { kind: 'new' } | { kind: 'same' } | { kind: 'up' | 'down'; places: number };

/**
 * `currentRank` / `previousRank`: position in the list (a division's champion
 * is 0, contenders count from 1). `hasPreviousWeek` false = no earlier
 * snapshot at all (first week), so nothing to compare -- not "new".
 * A previousRank of null with an earlier snapshot = wasn't in that list last week.
 */
export function rankTrend(currentRank: number, previousRank: number | null | undefined, hasPreviousWeek: boolean): RankTrend {
  if (!hasPreviousWeek) return { kind: 'none' };
  if (previousRank === null || previousRank === undefined) return { kind: 'new' };
  if (previousRank === currentRank) return { kind: 'same' };
  return previousRank > currentRank ? { kind: 'up', places: previousRank - currentRank } : { kind: 'down', places: currentRank - previousRank };
}
