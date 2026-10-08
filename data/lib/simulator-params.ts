// data/lib/simulator-params.ts
//
// Pure helpers behind the fight simulator's shareable URL
// (/simulateur?a=<fighter_id>&b=<fighter_id>) and the main-event prefill.

type ParamFighter = { fighter_id: number; weight_class: string };
type NamedFighter = ParamFighter & { fighter_name: string };

export type SimulatorSelection = { a: number | null; b: number | null };

const isWomenClass = (fighter: ParamFighter) => fighter.weight_class.startsWith("Women's");

function parseId(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !/^\d{1,9}$/.test(value.trim())) return null;
  const id = Number(value);
  return id > 0 ? id : null;
}

/**
 * Reads `a` / `b` from the page's searchParams. Unknown ids, a repeated id
 * (the second corner is dropped) and a men/women mix (the second corner is
 * dropped) are ignored; a corner that survives validation is kept on its own.
 */
export function parseSimulatorParams(
  raw: { a?: string | string[]; b?: string | string[] },
  fighters: ParamFighter[],
): SimulatorSelection {
  const byId = new Map(fighters.map((f) => [f.fighter_id, f]));
  const fa = byId.get(parseId(raw.a) ?? -1) ?? null;
  let fb = byId.get(parseId(raw.b) ?? -1) ?? null;
  if (fa && fb && (fa.fighter_id === fb.fighter_id || isWomenClass(fa) !== isWomenClass(fb))) fb = null;
  return { a: fa?.fighter_id ?? null, b: fb?.fighter_id ?? null };
}

/** The simulator URL for a selection; no params when both corners are empty. */
export function buildSimulatorPath(selection: SimulatorSelection): string {
  const params = new URLSearchParams();
  if (selection.a != null) params.set('a', String(selection.a));
  if (selection.b != null) params.set('b', String(selection.b));
  const query = params.toString();
  return query ? `/simulateur?${query}` : '/simulateur';
}

const normalizeName = (name: string) =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Finds the simulator entry for a fighter row of a fight: by id first (the
 * simulator is keyed by fighter_ratings.fighter_id, which is a fighters.id),
 * then by name, because one real fighter can have several `fighters` rows
 * (one per organization) and the rated one may be a sibling.
 */
export function matchSimulatorFighter<T extends NamedFighter>(
  fighters: T[],
  fightFighter: { id: number; name: string | null } | null,
): T | null {
  if (!fightFighter) return null;
  const byId = fighters.find((f) => f.fighter_id === fightFighter.id);
  if (byId) return byId;
  if (!fightFighter.name) return null;
  const needle = normalizeName(fightFighter.name);
  const byName = fighters.filter((f) => normalizeName(f.fighter_name) === needle);
  return byName.length === 1 ? byName[0] : null;
}
