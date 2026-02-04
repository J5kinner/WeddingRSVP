import type { NextConfig } from "next";
import setupBundleAnalyzer from '@next/bundle-analyzer';

const withBundleAnalyzer = setupBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: {
    turbopackUseSystemTlsCerts: true,
  },
};

export default withBundleAnalyzer(nextConfig);
