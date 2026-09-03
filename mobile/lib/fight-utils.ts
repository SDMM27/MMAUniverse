// mobile/lib/fight-utils.ts
//
// Duplicated from data/lib/fight-utils.ts (already covered by
// data/lib/fight-utils.test.ts) — see the note in mobile/components/country-flag.tsx.
export function splitMainEvent<T extends { is_main_event: boolean }>(
  fights: T[],
): { mainEvent: T | null; rest: T[] } {
  const mainEvent = fights.find((fight) => fight.is_main_event) ?? null;
  const rest = mainEvent ? fights.filter((fight) => !fight.is_main_event) : fights;
  return { mainEvent, rest };
}
