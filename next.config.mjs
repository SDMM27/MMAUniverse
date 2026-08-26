/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Fighter photos and event posters are hotlinked from Sherdog (scraped source,
    // see data/scrapers/sherdog.ts) — allow next/image to optimize them. Wildcard
    // covers both the main domain (fighter photos) and its CDN subdomains (event
    // posters, e.g. www1-cdn.sherdog.com).
    remotePatterns: [{ protocol: 'https', hostname: '**.sherdog.com' }],
  },
  async headers() {
    return [
      {
        // Public, read-only GET data (same as the website) — the mobile app's Expo web
        // target runs on a different origin/port than this API, so it needs CORS to fetch it.
        // Native Expo Go doesn't enforce CORS at all, so this only matters for the web target.
        source: '/api/mobile/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET' },
        ],
      },
    ];
  },
};

export default nextConfig;
