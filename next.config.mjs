/** @type {import('next').NextConfig} */
const nextConfig = {
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
