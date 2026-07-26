'use client';

import { useEffect } from 'react';

// The 500 boundary for a route render error, shown inside the site chrome. It is a
// Client Component (Next requires error boundaries to be) and deliberately shows
// nothing about the error — no message, no stack, no digest beyond the opaque id
// Next assigns for correlating server logs. The details go to the console/server
// logs, never to the page.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[render error]', error);
  }, [error]);

  return (
    <div className="mx-auto max-w-reader py-8">
      <p className="text-[13px] font-medium uppercase tracking-wide text-ink3">
        500
      </p>
      <h1 className="mt-1 text-[26px] font-semibold tracking-tight text-ink">
        Something went wrong on our side
      </h1>
      <p className="mb-8 mt-2 text-[16px] leading-relaxed text-ink2">
        This is our fault, not yours. The corpus, search and every published
        page are unaffected — try again, or head back to safe ground.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-accent px-4 py-2.5 text-[15px] font-medium text-on-accent hover:opacity-90"
        >
          Try again
        </button>
        <a
          href="/"
          className="rounded-md border border-line px-4 py-2.5 text-[15px] text-ink hover:border-line2"
        >
          Go home
        </a>
        <a
          href="/search"
          className="rounded-md border border-line px-4 py-2.5 text-[15px] text-ink hover:border-line2"
        >
          Search the corpus
        </a>
      </div>

      {error.digest ? (
        <p className="mt-6 text-[13px] text-ink3">
          Reference: <code>{error.digest}</code>
        </p>
      ) : null}
    </div>
  );
}
