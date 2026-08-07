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
  // Inline the CSS into the HTML instead of loading it as a render-blocking
  // stylesheet. That one request cost ~470ms of LCP on a cold load — the
  // difference between the measured 2.5-2.9s and the 1.8s budget. optimizeCss
  // (critters) was tried first and does nothing under the App Router; inlineCss
  // is the supported mechanism. The whole sheet is ~20KB compressed, an
  // acceptable per-page cost for removing the blocking fetch entirely.
  experimental: {
    inlineCss: true,
  },
  transpilePackages: ['@quranbench/corpus', '@quranbench/search'],
  eslint: { ignoreDuringBuilds: true },
  poweredByHeader: false,
  // Standalone output for a small, self-contained production image: Next traces
  // exactly the files the server needs. The tracing root is the repo, so the
  // workspace packages are traced (see docs/deployment.md, Dockerfile).
  output: 'standalone',
  outputFileTracingRoot: fileURLToPath(new URL('../..', import.meta.url)),
  // Security headers, set at the origin rather than in the nginx vhost — that
  // vhost sits in front of 41 unrelated sites and this app should carry its own
  // policy. HSTS and X-Content-Type-Options are already applied at the Cloudflare
  // edge and are deliberately not repeated here, to avoid duplicate headers.
  //
  // On the CSP: Next serves its hydration payload as inline <script> elements, and
  // the theme is applied by an inline script before first paint to avoid a flash.
  // A nonce-based policy would mean generating a nonce per request in middleware,
  // which forces every page out of static rendering — a real cost to a site whose
  // whole point is fast, complete, server-rendered pages. So script-src allows
  // inline. That is weaker than a nonce policy and worth revisiting, but it still
  // blocks the case that matters most here: injected *external* script.
  //
  // frame-ancestors 'none' is the substantive one. This site's claim is that the
  // text is unaltered and traceable; being embeddable in a hostile frame with an
  // overlay attacks exactly that claim.
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self'",
      "manifest-src 'self'",
      "worker-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      'upgrade-insecure-requests',
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
          },
        ],
      },
    ];
  },
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
