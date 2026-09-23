// mobile/lib/fighter-physique.ts
//
// Duplicated from data/lib/fighter-physique.ts (already covered by
// data/lib/fighter-physique.test.ts) — see the note in mobile/components/country-flag.tsx.
export function formatPhysique(heightCm: number | null | undefined, reachCm: number | null | undefined): string | null {
  const parts: string[] = [];
  if (heightCm) parts.push(`${(heightCm / 100).toFixed(2).replace('.', ',')} m`);
  if (reachCm) parts.push(`Allonge ${reachCm} cm`);
  return parts.length > 0 ? parts.join(' · ') : null;
}
