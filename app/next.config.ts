import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  productionBrowserSourceMaps: false,
  webpack: (config, { dev, isServer }) => {
    if (!dev) {
      config.devtool = false;
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
