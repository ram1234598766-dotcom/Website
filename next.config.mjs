/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  images: { unoptimized: true },
  trailingSlash: true,
  // Build story: `next build` + `opennextjs-cloudflare build` emits one Cloudflare
  // Worker (`.open-next/worker.js`, packaged by wrangler.toml). `standalone` — not
  // `export` — because the app ships server-rendered /api/* route handlers; there is
  // no static `out/` directory in the build.
  output: 'standalone',
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }],
      },
      {
        source: '/_next/static/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }],
      },
    ];
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns'],
  },
};

export default nextConfig;
