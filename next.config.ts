import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
  },
  productionBrowserSourceMaps: false,
  assetPrefix: '',
  trailingSlash: false,
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
