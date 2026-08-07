import type { Metadata } from 'next';

import { ReaderVerse } from '@/components/ReaderVerse';
import { SearchBar } from '@/components/SearchBar';
import { ProvenanceTag } from '@/components/ProvenanceTag';
import { searchString } from '@quranbench/search';
import { describeSegment, getCorpus, getIndex } from '@/server/corpus';
import { suggest, type Suggestion } from '@/server/suggest';

// `?q=` makes this an unbounded URL space. Left indexable it would compete for
// crawl budget with the 87,000 real, permanent URLs in the sitemap — and search
// result pages are thin duplicates of content that already has canonical homes on
// word, root and verse pages. `follow` is kept so the links out of a result page
// still pass crawlers through to those pages; the canonical points every variant
// back at the bare /search.
export const metadata: Metadata = {
  title: 'Search',
  description:
    'Search the Quran corpus by word, root, lemma, part of speech, pattern, proximity and reference — every result reproducible.',
  robots: { index: false, follow: true },
  alternates: { canonical: '/search' },
};

const MAX_SEGMENTS = 40;

// When a query parses but matches nothing (or fails to parse), the dead end
// should still lead somewhere: the same suggestion engine behind the search
// box dropdown proposes surahs, roots, words and glosses near what was typed.
function DidYouMean({ items }: { items: Suggestion[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-4">
      <p className="text-[14px] text-ink2">Did you mean:</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {items.slice(0, 5).map((s) => (
          <li key={`${s.type}-${s.label}`}>
            <a
              href={s.href ?? `/search?q=${encodeURIComponent(s.q ?? '')}`}
              dir="auto"
              className="inline-block rounded-full border border-line bg-panel px-3 py-1.5 text-[13px] text-ink hover:border-line2"
            >
              {s.label}
              <span className="ml-1.5 text-[11px] text-ink3">{s.type}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface SearchParams {
  searchParams: Promise<{ q?: string }>;
}

export default async function SearchPage({ searchParams }: SearchParams) {
  const { q } = await searchParams;
  const query = (q ?? '').trim();
  const index = getIndex();
  const corpus = getCorpus();

  const result = query ? searchString(index, query) : null;

  return (
    <div className="mx-auto max-w-reader">
      <h1 className="mb-4 text-[24px] font-semibold tracking-tight text-ink">Search</h1>
      <SearchBar defaultValue={query} />

      {!query ? (
        <p className="mt-10 text-[16px] text-ink2">
          Search {corpus.tokens.length.toLocaleString('en-US')} words. Try a root like{' '}
          <code className="rounded bg-soft px-1.5 py-0.5 text-[14px]" dir="rtl">
            root:ز ك و
          </code>
          , a pattern, or two words with <code className="rounded bg-soft px-1.5 py-0.5 text-[14px]">NEAR/10</code>.
        </p>
      ) : null}

      {result && !result.ok ? (
        <div className="mt-8 rounded-lg border border-line bg-panel p-5">
          <p className="text-[15px] text-ink">
            Could not parse the query at position {result.error.position}.
          </p>
          <p className="mt-1 text-[14px] text-ink2">{result.error.message}</p>
          <DidYouMean items={suggest(query)} />
        </div>
      ) : null}

      {result && result.ok ? (
        <div className="mt-8">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <p className="text-[15px] text-ink">
              <strong className="font-semibold">
                {result.result.totalMatches.toLocaleString('en-US')}
              </strong>{' '}
              token matches in {result.result.segmentIds.length.toLocaleString('en-US')} verses
            </p>
            <ProvenanceTag layer="computed" note={`corpus v${result.result.corpusVersion}`} />
          </div>

          <details className="mb-6 rounded-lg border border-line bg-panel px-4 py-3 text-[13px] text-ink2">
            <summary className="cursor-pointer text-ink2">How this was computed</summary>
            <dl className="mt-2 grid grid-cols-1 gap-1">
              <div className="flex gap-2">
                <dt className="text-ink3">Query:</dt>
                <dd dir="auto">
                  <code>{query}</code>
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-ink3">Corpus:</dt>
                <dd>v{result.result.corpusVersion}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-ink3">Numbering:</dt>
                <dd>{result.result.params.numberingScheme}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-ink3">Basmala counted:</dt>
                <dd>{String(result.result.params.includeBasmala)}</dd>
              </div>
            </dl>
          </details>

          {result.result.segmentIds.length === 0 ? (
            <div>
              <p className="text-[16px] text-ink2">
                No verses matched. Try a broader query — or, for English words,
                the{' '}
                <a href="/gloss" className="text-accent hover:underline">
                  reverse lookup
                </a>
                .
              </p>
              <DidYouMean items={suggest(query)} />
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {result.result.segmentIds.slice(0, MAX_SEGMENTS).map((segmentId) => {
                const view = describeSegment(segmentId);
                if (!view) return null;
                return (
                  <ReaderVerse
                    key={segmentId}
                    surahNumber={view.surahNumber}
                    surahName={view.surahName}
                    tokens={view.tokens}
                    from={view.ordinal ?? 0}
                    mode="result"
                    basmala={view.basmala}
                  />
                );
              })}
              {result.result.segmentIds.length > MAX_SEGMENTS ? (
                <p className="text-[14px] text-ink3">
                  Showing the first {MAX_SEGMENTS} of{' '}
                  {result.result.segmentIds.length.toLocaleString('en-US')} matched verses.
                </p>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
