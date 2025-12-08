import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  // Required for @react-three packages to work with Next.js
  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  productionBrowserSourceMaps: false,
  assetPrefix: '',
  trailingSlash: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.imgur.com',
        pathname: '/**',
      },
    ],
  },
  // Remove webpack config when using Turbopack for development
  // Turbopack is used in dev mode, webpack in production
  ...(process.env.NODE_ENV === 'production' && {
    webpack: (config, { dev, isServer }) => {
      if (!dev) {
        config.devtool = false;
        config.cache = false;
      }
      return config;
    },
  }),
};

export default nextConfig;
