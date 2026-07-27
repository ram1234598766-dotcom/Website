/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  eslint: { ignoreDuringBuilds: true },
  images: { unoptimized: true },
  experimental: {
    optimizePackageImports: ['lucide-react', '@monaco-editor/react', 'date-fns'],
  },
};

export default nextConfig;
