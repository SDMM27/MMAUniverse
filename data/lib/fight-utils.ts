// data/lib/fight-utils.ts
/**
 * Splits a fight list into the fight flagged is_main_event (if any) and
 * the rest, so a page can promote that one fight to FightCard while the
 * remainder stays FightRow. When nothing is flagged, mainEvent is null and
 * rest is the full, untouched list — callers fall back to today's
 * behavior (everything rendered as FightRow).
 */
export function splitMainEvent<T extends { is_main_event: boolean }>(
  fights: T[],
): { mainEvent: T | null; rest: T[] } {
  const mainEvent = fights.find((fight) => fight.is_main_event) ?? null;
  const rest = mainEvent ? fights.filter((fight) => fight !== mainEvent) : fights;
  return { mainEvent, rest };
}
