export type Gender = 'women' | 'men';

/**
 * Sherdog's weight classes don't tell men's and women's divisions apart
 * ("Flyweight" for both), and nothing else we scrape carries a gender. But
 * MMA bouts are never mixed, so a fighter's gender is their opponents'
 * gender: starting from fighters whose gender we know (UFCStats labels
 * women's bouts "Women's Flyweight"...), it spreads along the fight graph.
 *
 * Both genders spread at once, one hop at a time, and each fighter takes the
 * gender of the nearest known fighter. A single bad edge (a homonym's Sherdog
 * page attached to the wrong fighter) then only mislabels the fighters closer
 * to it than to any correct seed, instead of flipping a whole connected
 * component. A fighter reached by both genders at the same distance, or never
 * reached, stays unknown (absent from the result).
 */
export function inferGenders(seeds: Map<string, Gender>, edges: [string, string][]): Map<string, Gender> {
  const neighbours = new Map<string, string[]>();
  const link = (a: string, b: string) => {
    const list = neighbours.get(a);
    if (list) list.push(b);
    else neighbours.set(a, [b]);
  };
  for (const [a, b] of edges) {
    if (a === b) continue;
    link(a, b);
    link(b, a);
  }

  const result = new Map<string, Gender>(seeds);
  const conflicted = new Set<string>();
  let frontier = Array.from(seeds.keys());
  while (frontier.length > 0) {
    const reached = new Map<string, Gender | 'both'>();
    for (const node of frontier) {
      const gender = result.get(node);
      if (!gender) continue;
      for (const next of neighbours.get(node) ?? []) {
        if (result.has(next) || conflicted.has(next)) continue;
        const seen = reached.get(next);
        reached.set(next, seen && seen !== gender ? 'both' : gender);
      }
    }
    frontier = [];
    reached.forEach((gender, node) => {
      if (gender === 'both') {
        conflicted.add(node);
      } else {
        result.set(node, gender);
        frontier.push(node);
      }
    });
  }
  return result;
}
