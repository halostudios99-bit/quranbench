import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Offline',
  description: 'You are offline. Previously visited pages remain available.',
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <div className="mx-auto max-w-reader">
      <h1 className="text-[24px] font-semibold tracking-tight text-ink">
        You&rsquo;re offline
      </h1>
      <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink2">
        This page wasn&rsquo;t cached, so it can&rsquo;t load without a
        connection. Pages you have already visited stay readable offline.
      </p>
      <p className="mt-4 max-w-prose text-[14px] leading-relaxed text-ink3">
        Full offline search is not available: the corpus index is tens of
        megabytes and can&rsquo;t be built reliably in a phone browser. Offline
        support covers reading cached pages, not searching the whole corpus.
        Reconnect to search.
      </p>
      <p className="mt-6 text-[14px]">
        <a href="/" className="text-accent underline">
          Return to the reader
        </a>
      </p>
    </div>
  );
}
