'use client';

import { useEffect } from 'react';

import '@/styles/globals.css';

// The last-resort boundary: it replaces the root layout when the layout itself
// throws, so it must render its own <html> and <body>. No providers, no chrome —
// just an on-brand apology with a way home, and no internal detail exposed.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[global error]', error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main
          style={{
            maxWidth: '42rem',
            margin: '0 auto',
            padding: '3rem 1.25rem',
            fontFamily: 'system-ui, sans-serif',
            color: 'var(--ink, #16150f)',
            background: 'var(--bg, #faf9f6)',
          }}
        >
          <p
            style={{
              fontSize: 13,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              opacity: 0.6,
            }}
          >
            500
          </p>
          <h1 style={{ fontSize: 26, fontWeight: 600, marginTop: 4 }}>
            Something went wrong
          </h1>
          <p
            style={{
              fontSize: 16,
              lineHeight: 1.6,
              marginTop: 8,
              opacity: 0.8,
            }}
          >
            The site hit an unexpected error. Please try again — if it persists,
            come back shortly.
          </p>
          <div
            style={{
              marginTop: 24,
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              onClick={reset}
              style={{
                borderRadius: 6,
                background: 'var(--accent, #7a5c1e)',
                color: 'var(--on-accent, #fff)',
                border: 'none',
                padding: '0.6rem 1rem',
                fontSize: 15,
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{
                borderRadius: 6,
                border: '1px solid var(--line, #ddd)',
                color: 'var(--ink, #16150f)',
                padding: '0.6rem 1rem',
                fontSize: 15,
                textDecoration: 'none',
              }}
            >
              Go home
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
