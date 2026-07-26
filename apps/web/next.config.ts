import { fileURLToPath } from 'node:url';

import type { NextConfig } from 'next';

// The corpus and search packages are shipped as TypeScript source (their
// package `main` points at src/index.ts), so Next must transpile them.
const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Which build directory this process uses, chosen by the environment so a
  // deploy can build into a directory the running server is not reading.
  //
  // `next build` rewrites its dist directory in place, so building into the one
  // the live server is serving takes the site down for the length of the build —
  // pm2 crash-loops and, after 15 failures, gives up entirely. Instead the deploy
  // alternates between two slots (.next-a / .next-b): it builds into the idle one
  // while the live process keeps serving the active one, then restarts pm2 with
  // NEXT_DIST_DIR pointing at the new slot. Downtime is the restart, not the
  // build. Defaults to `.next` so local development is unchanged.
  // See scripts/deploy-atomic.sh.
  distDir: process.env.NEXT_DIST_DIR || '.next',
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
