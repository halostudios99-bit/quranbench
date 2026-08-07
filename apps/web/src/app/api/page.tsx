import type { Metadata } from 'next';

import { RATE_LIMIT_PER_MINUTE } from '@/server/api/http';

export const metadata: Metadata = {
  title: 'API — QuranBench',
  description:
    'A public, keyless JSON API over the QuranBench corpus: verses, words, roots, translations and the manifest, with stable identifiers.',
};

// The API existed for months with no front door: every endpoint worked, the
// OpenAPI spec was served, and nothing on the site linked either. This page is
// deliberately plain — a list of what exists, the one rule (be gentle), and
// where the machine-readable contract lives.

const ENDPOINTS: [string, string][] = [
  ['/api/v1/versions', 'Corpus versions available on this server'],
  ['/api/v1/manifest', 'The full manifest of the current corpus, with checksums'],
  ['/api/v1/surah/{number}', 'One surah: metadata and its verses'],
  ['/api/v1/verse/{surah}/{ayah}', 'One verse: text, tokens, translations'],
  ['/api/v1/token/{id}', 'One word: morphology, gloss, transliteration, root'],
  ['/api/v1/resolve?ref=…', 'Resolve a citation string to its verse or word'],
];

export default function ApiPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-[28px] font-semibold text-ink">API</h1>
      <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink2">
        Everything the site shows is readable as JSON, keyless and
        cross-origin. Responses carry the corpus version they were served
        from, so a result can always be traced to the exact data release
        behind it.
      </p>

      <h2 className="mt-8 text-[17px] font-semibold text-ink">Endpoints</h2>
      <ul className="mt-3 flex flex-col divide-y divide-line">
        {ENDPOINTS.map(([path, desc]) => (
          <li key={path} className="py-3">
            <code className="text-[14px] text-accent">{path}</code>
            <p className="mt-1 text-[14px] leading-relaxed text-ink2">{desc}</p>
          </li>
        ))}
      </ul>

      <h2 className="mt-8 text-[17px] font-semibold text-ink">The contract</h2>
      <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink2">
        The machine-readable specification lives at{' '}
        <a
          href="/api/v1/openapi.json"
          className="inline-block py-1 text-accent hover:underline"
        >
          /api/v1/openapi.json
        </a>
        . The rate limit is {RATE_LIMIT_PER_MINUTE} requests per IP per
        minute, disclosed on every response in{' '}
        <code className="text-[13px]">x-ratelimit-limit</code> and{' '}
        <code className="text-[13px]">x-ratelimit-remaining</code>; exceeding
        it returns 429 with <code className="text-[13px]">retry-after</code>.
        Responses are cacheable and served identically to everyone — there are
        no keys, tiers or accounts.
      </p>
      <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink2">
        For bulk work, download the corpus from{' '}
        <a href="/data" className="inline-block py-1 text-accent hover:underline">
          /data
        </a>{' '}
        instead of crawling the API — it is the same data, checksummed, in
        one archive.
      </p>
    </main>
  );
}
