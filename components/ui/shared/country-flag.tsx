// components/ui/shared/country-flag.tsx
//
// Renders an ISO 3166-1 alpha-2 country code (e.g. 'FR') as an actual flag
// icon rather than the flag *emoji*. The emoji approach (see
// data/lib/flag-utils.ts) works by combining two Unicode regional indicator
// symbols and letting the OS font render the pair as a flag glyph — but
// Windows' emoji font deliberately doesn't ship flag glyphs, so it falls
// back to showing the two regional indicator letters as plain text (e.g.
// "FR", "NZ") instead of a flag. Using real flag SVGs (via the `flag-icons`
// package, whose CSS is imported once in app/layout.tsx) renders
// identically on every OS.
//
// Sherdog (data/scrapers/parse.ts, unmerged feat/fighter-nationality-scraping
// branch) encodes a fighter's nationality as the filename of their flag
// image, and for the UK's constituent countries that isn't a real ISO 3166-1
// code: England is "en", Wales is "wa", Northern Ireland is "nb" — all
// already stored as-is in `fighters.nationality` (confirmed live: 238
// England, 19 Wales, 8 Northern Ireland fighters). `flag-icons` doesn't ship
// `.fi-en`/`.fi-wa`/`.fi-nb` (they're not ISO codes), but it does ship the
// UK's own non-ISO subdivision flags under "gb-eng"/"gb-wls"/"gb-nir" — this
// map redirects our three codes there. Scotland's Sherdog flag file is
// "sct.png" — its *three*-letter length silently broke the (2-letter-only)
// scrape regex on that branch, so no Scottish fighter has any nationality
// value in the database yet; "sc" is reserved here for when that scrape gap
// is fixed and backfilled (whichever 2-letter code is then chosen to store).
const NON_ISO_UK_CODES: Record<string, { flagClass: string; label: string }> = {
  en: { flagClass: 'gb-eng', label: 'Angleterre' },
  wa: { flagClass: 'gb-wls', label: 'Pays de Galles' },
  nb: { flagClass: 'gb-nir', label: 'Irlande du Nord' },
  sc: { flagClass: 'gb-sct', label: 'Écosse' },
};

export function CountryFlag({
  code,
  className = 'text-xl',
}: {
  code: string | null;
  className?: string;
}) {
  if (!code) return null;
  const normalized = code.trim().toLowerCase();
  if (!/^[a-z]{2}$/.test(normalized)) return null;

  const override = NON_ISO_UK_CODES[normalized];

  return (
    <span
      className={`fi fi-${override?.flagClass ?? normalized} ${className}`}
      role="img"
      aria-label={`Drapeau : ${override?.label ?? code.trim().toUpperCase()}`}
    />
  );
}
