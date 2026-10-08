import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/data/lib/site-url';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/profil', '/mes-pronostics', '/onboarding', '/sign-in', '/sign-up'],
    },
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}
