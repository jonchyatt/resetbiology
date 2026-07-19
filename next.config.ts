import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  // Canonicalize www -> apex BEFORE any request reaches middleware/auth.
  // Auth0's /auth/login sets its state cookie on whatever host served the
  // request; if that's www.resetbiology.com but the configured redirect_uri
  // sends the callback back to the bare apex, the state cookie never
  // round-trips and Auth0 rejects with "state parameter is invalid".
  // next.config redirects are evaluated by Vercel's routing layer ahead of
  // middleware, so this fires first for every host-matched request.
  // https://nextjs.org/docs/app/api-reference/config/next-config-js/redirects#header-cookie-and-query-matching
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.resetbiology.com' }],
        destination: 'https://resetbiology.com/:path*',
        permanent: true,
      },
      {
        source: '/trial',
        destination: '/get-started',
        permanent: true,
      },
      {
        source: '/audio',
        destination: '/modules',
        permanent: true,
      },
      {
        source: '/cellular-peptide',
        destination: '/order',
        permanent: true,
      },
      {
        source: '/cellular-peptide/:slug',
        destination: '/order',
        permanent: true,
      },
    ];
  },
  // Required for @react-three packages to work with Next.js
  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  productionBrowserSourceMaps: false,
  assetPrefix: '',
  trailingSlash: false,
  images: {
    remotePatterns: [],
  },
  webpack: (config: any, { dev, isServer }: any) => {
    if (!isServer) {
      // Ensure ONNX Runtime WASM files are served correctly (for Whisper Web Worker)
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      }
    }
    if (!dev) {
      config.devtool = false;
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
