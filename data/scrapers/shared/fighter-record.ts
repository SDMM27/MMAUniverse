import type { ScrapedFighter } from './types';

/**
 * The fighter's 'W-L-D' record, kept in step with their own fight history.
 *
 * `record` is captured when the fighter is first scraped (usually while their
 * next fight is still upcoming), but the post-fight refresh only rewrites
 * `fight_history` -- so a fighter's header kept showing their pre-fight
 * record (Joshua Van at 17-2-0 with 18 wins listed below it). Both come from
 * the same Sherdog page, so counting the history gives the up-to-date record.
 *
 * The history only wins when it holds at least as many results as `record`:
 * a shorter one means a homonym's page got attached to this fighter, and the
 * scraped header is then the safer of the two.
 */
export function currentRecord(fighter: Pick<ScrapedFighter, 'record' | 'fight_history'>): string {
  const history = fighter.fight_history ?? [];
  if (history.length === 0) return fighter.record;
  const counted = (['win', 'loss', 'draw'] as const).map((result) => history.filter((h) => h.result === result).length);
  const recorded = (fighter.record ?? '').split('-').map((n) => Number(n) || 0);
  const total = (values: number[]) => values.reduce((sum, n) => sum + n, 0);
  return total(counted) >= total(recorded) ? counted.join('-') : fighter.record;
}
