// mobile/components/country-flag.tsx
//
// Duplicated from web's components/ui/shared/country-flag.tsx rather than
// shared — this repo keeps web and mobile data/UI logic in separate,
// duplicated files (see mobile/lib/types.ts vs. data/lib/definitions.ts) —
// but the *approach* has to differ, not just the copy: web replaced an emoji
// flag with a real SVG because Windows' emoji font doesn't render flag
// glyphs; there is no equivalent "OS won't draw this" workaround available
// here for a bare RN <Text>, so mobile needs an actual image too, not just a
// literal copy of the old emoji code (previously mobile/lib/flag-utils.ts,
// now deleted — its countryCodeToFlag had no remaining callers once this
// replaced it everywhere).
//
// That old approach was an even bigger problem on mobile than on web: Sherdog
// keys the UK's constituent countries with non-ISO codes — England "en",
// Wales "wa", Northern Ireland "nb", Scotland "sc" (see data/scrapers/parse.ts's
// design and the "sct" → "SC" normalization in
// data/scrapers/backfill-fighter-nationality.ts) — and combining regional
// indicators for those doesn't produce a *real* flag emoji sequence at all,
// so nothing rendered for ~280 UK fighters on any platform, not just Windows.
//
// This renders an actual flag image via flagcdn.com (the same
// lipis/flag-icons-adjacent project the web app's `flag-icons` npm package
// comes from — confirmed it serves the same "gb-eng"/"gb-nir"/"gb-sct"/
// "gb-wls" subdivision codes) instead of relying on any device's emoji font.
//
// flagcdn only serves a fixed list of pixel sizes per axis (h20/h24/h40/h48/
// h60/h80/..., not arbitrary values — confirmed directly: h28 404s while its
// neighbors h24 and h40 both work) — so this always fetches the same safe,
// known-good "w80" source image and lets RN scale it down to `height` via
// `resizeMode: 'contain'`, rather than trying to compute a source size from
// the requested display size and risk landing on an unsupported one again.
import { Image } from 'react-native';

const NON_ISO_UK_CODES: Record<string, string> = {
  en: 'gb-eng',
  wa: 'gb-wls',
  nb: 'gb-nir',
  sc: 'gb-sct',
};

export function CountryFlag({ code, height = 16 }: { code: string | null; height?: number }) {
  if (!code) return null;
  const normalized = code.trim().toLowerCase();
  if (!/^[a-z]{2}$/.test(normalized)) return null;

  const flagCode = NON_ISO_UK_CODES[normalized] ?? normalized;
  // Fixed 4:3 box with `resizeMode: 'contain'`, matching the web CountryFlag's
  // `background-size: contain` box — real flags vary in proportions (the UK
  // subdivision flags are wider than 4:3), so this letterboxes rather than
  // stretching/cropping any of them.
  const width = Math.round((height * 4) / 3);

  return (
    <Image
      source={{ uri: `https://flagcdn.com/w80/${flagCode}.png` }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Drapeau : ${code.trim().toUpperCase()}`}
      resizeMode="contain"
      style={{ width, height, borderRadius: 2 }}
    />
  );
}
