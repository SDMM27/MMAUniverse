// data/lib/fighter-physique.ts
//
// Height/reach line for the fighter page header (see
// data/scrapers/sync-fighter-physique.ts for where the numbers come from).
// Reach only exists for UFC fighters, and many regional fighters have no
// height either -- whatever is missing is simply left out.
export function formatPhysique(heightCm: number | null | undefined, reachCm: number | null | undefined): string | null {
  const parts: string[] = [];
  if (heightCm) parts.push(`${(heightCm / 100).toFixed(2).replace('.', ',')} m`);
  if (reachCm) parts.push(`Allonge ${reachCm} cm`);
  return parts.length > 0 ? parts.join(' · ') : null;
}
