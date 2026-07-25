import type { NextConfig } from 'next';

// The corpus and search packages are shipped as TypeScript source (their
// package `main` points at src/index.ts), so Next must transpile them.
const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@quranbench/corpus', '@quranbench/search'],
  eslint: { ignoreDuringBuilds: true },
  poweredByHeader: false,
  // The corpus/search packages ship TypeScript ESM that imports with explicit
  // `.js` specifiers. Map those back to `.ts` sources so webpack resolves them.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
    return config;
  },
};

export default nextConfig;
