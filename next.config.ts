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
