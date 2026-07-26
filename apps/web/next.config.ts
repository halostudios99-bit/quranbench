import { fileURLToPath } from 'node:url';

import type { NextConfig } from 'next';

// The corpus and search packages are shipped as TypeScript source (their
// package `main` points at src/index.ts), so Next must transpile them.
const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@quranbench/corpus', '@quranbench/search'],
  eslint: { ignoreDuringBuilds: true },
  poweredByHeader: false,
  // Standalone output for a small, self-contained production image: Next traces
  // exactly the files the server needs. The tracing root is the repo, so the
  // workspace packages are traced (see docs/deployment.md, Dockerfile).
  output: 'standalone',
  outputFileTracingRoot: fileURLToPath(new URL('../..', import.meta.url)),
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
