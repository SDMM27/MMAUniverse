// data/lib/fighter-age.ts
//
// Age for the fighter page header, from fighters.birth_date (see
// data/scrapers/sync-fighter-physique.ts). Computed at render time rather
// than stored, so it ticks over on the birthday without a resync.
//
// The DB driver hands a DATE column back as a JS Date at *local* midnight, so
// a Date is read with local getters; a 'YYYY-MM-DD' string is read as-is.
export function ageFromBirthDate(birthDate: Date | string | null | undefined, today: Date = new Date()): number | null {
  if (!birthDate) return null;
  let year: number, month: number, day: number;
  if (birthDate instanceof Date) {
    if (Number.isNaN(birthDate.getTime())) return null;
    [year, month, day] = [birthDate.getFullYear(), birthDate.getMonth() + 1, birthDate.getDate()];
  } else {
    const match = birthDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;
    [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  }
  const hadBirthdayThisYear =
    today.getMonth() + 1 > month || (today.getMonth() + 1 === month && today.getDate() >= day);
  const age = today.getFullYear() - year - (hadBirthdayThisYear ? 0 : 1);
  return age >= 0 && age < 100 ? age : null;
}
