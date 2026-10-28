/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // The Vercel image-optimization quota ran out (every /_next/image answered
    // 402, so every photo fell back to the silhouette). Images are served as-is:
    // fighter photos come from Commons, the rest are our own files.
    unoptimized: true,
    // No Sherdog/ESPN images anymore: organization logos are our own files in
    // public/logos/ (data/lib/org-logos.ts) and event posters aren't kept.
    remotePatterns: [
      // Fighter photos: Wikimedia Commons only (free licenses, see
      // data/scrapers/sync-fighter-photos.ts).
      { protocol: 'https', hostname: 'upload.wikimedia.org' },
      { protocol: 'https', hostname: 'thumb.wikimedia.org' },
    ],
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
