/**
 * Absolute URL of the site (no trailing slash), used for metadataBase, the
 * sitemap and canonical links. Order: explicit NEXT_PUBLIC_SITE_URL, then
 * Vercel's production domain, then localhost for development.
 */
export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return normalize(explicit);
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return normalize(vercel);
  return 'http://localhost:3000';
}

function normalize(value: string): string {
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return withProtocol.replace(/\/+$/, '');
}
