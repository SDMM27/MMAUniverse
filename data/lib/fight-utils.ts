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
  const rest = mainEvent ? fights.filter((fight) => !fight.is_main_event) : fights;
  return { mainEvent, rest };
}

/**
 * The data model has no explicit "scheduled rounds" field, so this derives it
 * from the two signals available: main events and title fights go 5 rounds
 * (a title fight can sit as a co-main and still be 5 rounds even when it
 * isn't `is_main_event`), everything else goes 3 — the standard MMA
 * convention.
 */
export function getScheduledRounds(fight: { is_main_event: boolean; is_title_fight: boolean }): number {
  return fight.is_main_event || fight.is_title_fight ? 5 : 3;
}
