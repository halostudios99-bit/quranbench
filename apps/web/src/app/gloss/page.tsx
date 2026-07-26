import type { Metadata } from 'next';

import { ProvenanceTag } from '@/components/ProvenanceTag';
import { glossHref } from '@/lib/addressing';
import { getCorpus, listGlossIndex } from '@/server/corpus';

// The reverse-gloss index: which single English glosses the Quranic Arabic Corpus
// hangs on many different Arabic roots. This is the "detect narrowing" surface —
// where English collapses distinct Arabic words into one — so it leads with the
// glosses spanning the most distinct roots, not an alphabetical dump. Server-
// rendered and crawlable; the filter is a plain GET form so it works without JS.

export const metadata: Metadata = {
  title: 'Glosses — English renderings ranked by the Arabic they collapse',
  description:
    "Every English gloss the Quranic Arabic Corpus attaches to Arabic words, ranked by how many distinct Arabic roots share it — the words where one English rendering hides several different Arabic words. A computed reverse lookup; open any gloss to see what was merged.",
  alternates: { canonical: '/gloss' },
};

// How many rows to render at once. The filter searches every gloss key; this only
// caps what one page paints, keeping the server HTML light.
const PAGE_LIMIT = 200;

interface SearchParams {
  searchParams: Promise<{ q?: string }>;
}

export default async function GlossIndexPage({ searchParams }: SearchParams) {
  const { q } = await searchParams;
  const result = listGlossIndex(q ?? '', PAGE_LIMIT);
  const corpusVersion = getCorpus().version;

  return (
    <div className="mx-auto max-w-reader">
      <nav aria-label="Breadcrumb" className="mb-3 text-[13px] text-ink3">
        <a href="/" className="hover:text-ink2">
          Read
        </a>
        <span aria-hidden="true"> / </span>
        <span className="text-ink2">Glosses</span>
      </nav>

      <header className="mb-6">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <ProvenanceTag layer="external" note="Leeds QAC gloss (GPL)" />
          <span className="font-ui text-[13px] text-ink3">
            Reverse gloss index
          </span>
        </div>
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-ink">
          Glosses
        </h1>
        <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink2">
          Every English word the Quranic Arabic Corpus uses to gloss the Arabic,
          ranked by how many <strong>distinct Arabic roots</strong> it collapses
          into one rendering. The glosses at the top are where English hides the
          most: several different Arabic words all rendered the same way. Open one
          to see exactly which words were merged. This is a{' '}
          <strong>computed</strong> reverse lookup over an external annotation —
          never a translation of any verse, never Quranic text.
        </p>
      </header>

      <form method="get" role="search" className="mb-6 flex flex-wrap gap-2">
        <label htmlFor="q" className="sr-only">
          Filter glosses
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={result.query}
          placeholder="Filter glosses, e.g. reward"
          className="min-w-0 flex-1 rounded-lg border border-line bg-panel px-3 py-2 text-[15px] text-ink placeholder:text-ink3 focus:border-line2 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-lg border border-line bg-panel px-4 py-2 font-ui text-[14px] text-ink hover:border-line2"
        >
          Filter
        </button>
        {result.query ? (
          <a
            href="/gloss"
            className="rounded-lg px-3 py-2 font-ui text-[14px] text-ink3 hover:text-ink2"
          >
            Clear
          </a>
        ) : null}
      </form>

      <p className="mb-4 text-[14px] text-ink2">
        {result.query ? (
          <>
            <strong>{result.matched.toLocaleString('en-US')}</strong> gloss
            {result.matched === 1 ? '' : 'es'} match{' '}
            <em>“{result.query}”</em>
            {result.matched > result.items.length
              ? `, showing the first ${result.items.length.toLocaleString('en-US')}`
              : ''}
            .
          </>
        ) : (
          <>
            <strong>{result.total.toLocaleString('en-US')}</strong> distinct
            glosses, ranked by distinct root count. Showing the top{' '}
            {result.items.length.toLocaleString('en-US')}.
          </>
        )}
      </p>

      {result.items.length === 0 ? (
        <p className="rounded-xl border border-line bg-panel px-5 py-8 text-center text-[15px] text-ink3">
          No gloss matches that filter.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {result.items.map((item) => (
            <li key={item.slug}>
              <a
                href={glossHref(item.key)}
                className="flex items-center justify-between gap-4 rounded-lg border border-line bg-panel px-4 py-3 hover:border-line2"
              >
                <span className="min-w-0 flex-1 truncate text-[16px] text-ink">
                  “{item.gloss}”
                </span>
                <span className="flex shrink-0 items-center gap-3 font-ui text-[13px] text-ink3">
                  <span
                    title="distinct Arabic roots sharing this gloss"
                    className={
                      item.rootCount > 1
                        ? 'font-medium text-accent'
                        : undefined
                    }
                  >
                    {item.rootCount} root{item.rootCount === 1 ? '' : 's'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span title="total occurrences">
                    {item.total.toLocaleString('en-US')} occ
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}

      <footer className="mt-8 border-t border-line pt-5 text-[12px] leading-relaxed text-ink3">
        <p>
          Corpus v{corpusVersion}. Glosses are the word-by-word English renderings
          of the Quranic Arabic Corpus (Kais Dukes, Leeds), licensed
          GPL-2.0-or-later. Grouping folds punctuation and bracketed helpers to a
          key: the corpus carries{' '}
          <strong>{result.distinctVerbatim.toLocaleString('en-US')}</strong>{' '}
          distinct verbatim gloss strings, which key to{' '}
          <strong>{result.total.toLocaleString('en-US')}</strong> distinct
          glosses. Ranking is by distinct <code>morphology.root_slug</code> per
          key over the loaded corpus.
        </p>
      </footer>
    </div>
  );
}
