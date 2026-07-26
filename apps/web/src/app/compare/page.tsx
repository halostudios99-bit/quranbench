import type { Metadata } from 'next';

import { OccurrenceChips } from '@/components/OccurrenceChips';
import { ProvenanceTag } from '@/components/ProvenanceTag';
import { ReaderVerse } from '@/components/ReaderVerse';
import { VerseTranslations } from '@/components/VerseTranslations';
import { parseAyahParam, parseSurahParam, verseHref } from '@/lib/addressing';
import { DIVERGENCE_THRESHOLD } from '@/lib/translations';
import {
  getCorpus,
  getVerseDivergence,
  getVerseRange,
  getVerseTranslations,
  listRedistributableEditions,
  reverseLookupWord,
  type VerseView,
} from '@/server/corpus';

// The translation laboratory. Every comparison is a permalink, server-rendered and
// crawlable: the query lives in the URL (`?v=2:255`, `?v=2:1-5`, or `?q=mercy`).
// Divergence is computed, never curated; reverse lookup is honest that its
// correspondence is verse-level, not word-level.

const MAX_RANGE = 20;
const REVERSE_LIMIT = 50;

interface CompareParams {
  searchParams: Promise<{ v?: string; q?: string }>;
}

function parseRef(v: string): { surah: number; from: number; to: number } | null {
  const [surahPart, ayahPart] = v.split(':');
  if (!surahPart || !ayahPart) return null;
  const surah = parseSurahParam(surahPart);
  const range = parseAyahParam(ayahPart);
  if (!surah || !range) return null;
  return { surah, from: range.from, to: Math.min(range.to, range.from + MAX_RANGE - 1) };
}

export async function generateMetadata({ searchParams }: CompareParams): Promise<Metadata> {
  const { v, q } = await searchParams;
  const canonical = v ? `/compare?v=${v}` : q ? `/compare?q=${q}` : '/compare';
  const title = v
    ? `Compare translations · ${v}`
    : q
      ? `Verses rendering “${q}” · Compare`
      : 'Compare translations';
  return {
    title,
    description:
      'Side-by-side public-domain Quran translation editions, with computed divergence detection and verse-level reverse lookup. Every comparison is reproducible.',
    alternates: { canonical },
  };
}

export default async function ComparePage({ searchParams }: CompareParams) {
  const { v, q } = await searchParams;
  // The translation laboratory deals only in redistributable editions — the ones a
  // reader can also download and cite. Display-only editions (e.g. Itani) appear in
  // the reader, not here, so the "public-domain editions" framing stays accurate.
  const editions = listRedistributableEditions();
  const editionIds = editions.map((e) => e.id);
  const corpus = getCorpus();
  const ref = v ? parseRef(v.trim()) : null;
  const views: VerseView[] = ref ? getVerseRange(ref.surah, ref.from, ref.to) : [];
  const reverse =
    q && q.trim() ? reverseLookupWord(q.trim(), REVERSE_LIMIT, editionIds) : null;

  return (
    <div className="mx-auto max-w-reader">
      <h1 className="mb-2 text-[24px] font-semibold tracking-tight text-ink">
        Translation laboratory
      </h1>
      <p className="mb-6 text-[15px] text-ink2">
        Compare {editions.length} public-domain English editions side by side. Enter a
        verse or range, or find which verses render an English word.
      </p>

      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <form action="/compare" method="get" className="flex flex-col gap-2">
          <label htmlFor="cmp-v" className="text-[13px] text-ink2">
            Verse or range (e.g. <code>2:255</code> or <code>2:1-5</code>)
          </label>
          <div className="flex gap-2">
            <input
              id="cmp-v"
              name="v"
              defaultValue={v ?? ''}
              placeholder="2:255"
              className="flex-1 rounded-lg border border-line bg-panel px-3 py-2 text-[16px] text-ink sm:text-[15px]"
            />
            <button
              type="submit"
              className="rounded-lg border border-line bg-soft px-4 py-2 text-[14px] text-ink hover:border-line2"
            >
              Compare
            </button>
          </div>
        </form>

        <form action="/compare" method="get" className="flex flex-col gap-2">
          <label htmlFor="cmp-q" className="text-[13px] text-ink2">
            English word (verse-level reverse lookup)
          </label>
          <div className="flex gap-2">
            <input
              id="cmp-q"
              name="q"
              defaultValue={q ?? ''}
              placeholder="mercy"
              className="flex-1 rounded-lg border border-line bg-panel px-3 py-2 text-[16px] text-ink sm:text-[15px]"
            />
            <button
              type="submit"
              className="rounded-lg border border-line bg-soft px-4 py-2 text-[14px] text-ink hover:border-line2"
            >
              Find verses
            </button>
          </div>
        </form>
      </div>

      {ref && views.length > 0 ? (
        <VerseComparison views={views} editionIds={editionIds} />
      ) : v ? (
        <p className="text-[16px] text-ink2">
          Could not resolve <code>{v}</code>. Use a form like <code>2:255</code> or{' '}
          <code>2:1-5</code>.
        </p>
      ) : null}

      {reverse ? <ReverseLookup query={reverse.word || (q ?? '')} result={reverse} /> : null}

      {!v && !q ? (
        <p className="text-[15px] text-ink2">
          Try <a href="/compare?v=2:255" className="text-accent hover:underline">2:255</a>,{' '}
          <a href="/compare?v=112:1-4" className="text-accent hover:underline">112:1-4</a>, or{' '}
          <a href="/compare?q=mercy" className="text-accent hover:underline">the word “mercy”</a>.
        </p>
      ) : null}

      <ComputationNote corpusVersion={corpus.version} editionCount={editions.length} />
    </div>
  );
}

function VerseComparison({
  views,
  editionIds,
}: {
  views: VerseView[];
  editionIds: string[];
}) {
  return (
    <div className="flex flex-col gap-5">
      {views.map((view) => {
        const items = getVerseTranslations(view.segment.id, editionIds);
        const divergence = getVerseDivergence(view.segment.id, editionIds);
        const ordinal = view.ordinal;
        return (
          <section
            key={view.segment.id}
            className="rounded-xl border border-line bg-panel px-5 py-5"
            data-testid="compare-verse"
            data-divergent={String(divergence.divergent)}
          >
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <a
                href={verseHref(view.segment.surah, ordinal)}
                className="font-ui text-[14px] font-semibold text-ink hover:underline"
              >
                {view.segment.surah}:{ordinal}
              </a>
              {divergence.editionCount >= 2 ? (
                divergence.divergent ? (
                  <ProvenanceTag
                    layer="computed"
                    note={`materially divergent · min J=${divergence.minJaccard.toFixed(2)}`}
                  />
                ) : (
                  <ProvenanceTag
                    layer="computed"
                    note={`editions agree · min J=${divergence.minJaccard.toFixed(2)}`}
                  />
                )
              ) : null}
            </div>

            <ReaderVerse
              surahNumber={view.segment.surah}
              surahName={`Surah ${view.segment.surah}`}
              tokens={view.tokens}
              from={ordinal}
              mode="compact"
              showActions={false}
            />

            <VerseTranslations items={items} />

            {divergence.pairs.length > 1 ? (
              <details className="mt-3 text-[12px] text-ink3">
                <summary className="cursor-pointer">Pairwise similarity</summary>
                <ul className="mt-2 flex flex-col gap-1">
                  {divergence.pairs.map((p) => (
                    <li key={`${p.a}·${p.b}`}>
                      {p.a} ↔ {p.b}: Jaccard {p.jaccard.toFixed(2)}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

function ReverseLookup({
  query,
  result,
}: {
  query: string;
  result: ReturnType<typeof reverseLookupWord>;
}) {
  return (
    <div className="flex flex-col gap-4" data-testid="reverse-lookup">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-[15px] text-ink">
          <strong>{result.total.toLocaleString('en-US')}</strong> verse
          {result.total === 1 ? '' : 's'} render the word{' '}
          <code className="rounded bg-soft px-1.5 py-0.5">{query}</code> in some edition
        </p>
        <ProvenanceTag layer="computed" note="verse-level correspondence" />
      </div>
      <p className="rounded-lg border border-line bg-panel px-4 py-3 text-[13px] text-ink2">
        This is <strong>verse-level</strong> correspondence, not word-level alignment:
        it shows which verses use “{query}” in an edition and the Arabic tokens of those
        verses — it does <strong>not</strong> claim which Arabic word “{query}” renders.
      </p>

      {result.occurrences.map((occ) => (
        <section key={occ.verseId} className="rounded-xl border border-line bg-panel px-5 py-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <a href={occ.href} className="font-ui text-[14px] font-semibold text-ink hover:underline">
              {occ.ref}
            </a>
            <span className="text-[12px] text-ink3">
              matched in {occ.editions.map((e) => e.edition.translator).join(', ')}
            </span>
          </div>
          {occ.tokens.length > 0 ? (
            <div className="mb-2">
              <OccurrenceChips
                items={occ.tokens.map((t) => ({
                  tokenId: t.id,
                  segmentId: t.segment_id,
                  surah: t.surah,
                  ordinal: null,
                  position: t.position,
                  text: t.text_uthmani,
                  ref: `${occ.ref}:${t.position}`,
                  href: occ.href,
                  wordHref: `/word/${encodeURIComponent(t.id)}`,
                }))}
              />
            </div>
          ) : null}
          <VerseTranslations
            items={occ.editions.map((e) => ({ edition: e.edition, text: e.text }))}
            compact
          />
        </section>
      ))}
      {result.total > result.occurrences.length ? (
        <p className="text-[13px] text-ink3">
          Showing the first {result.occurrences.length} of {result.total.toLocaleString('en-US')}{' '}
          verses.
        </p>
      ) : null}
    </div>
  );
}

function ComputationNote({
  corpusVersion,
  editionCount,
}: {
  corpusVersion: string;
  editionCount: number;
}) {
  return (
    <details className="mt-10 rounded-lg border border-line bg-panel px-4 py-3 text-[13px] text-ink2">
      <summary className="cursor-pointer text-ink2">How this was computed</summary>
      <div className="mt-2 flex flex-col gap-2">
        <dl className="grid grid-cols-1 gap-1">
          <div className="flex gap-2">
            <dt className="text-ink3">Corpus:</dt>
            <dd>v{corpusVersion}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-ink3">Editions compared:</dt>
            <dd>{editionCount} (public-domain English)</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-ink3">Alignment:</dt>
            <dd>verse-level only (no word-level translation alignment exists)</dd>
          </div>
        </dl>
        <p>
          <strong>Divergence method.</strong> For each verse, every edition&rsquo;s text
          is lowercased, stripped of punctuation and stopwords, and light-stemmed to a
          set of significant word-stems. We take the minimum pairwise{' '}
          <a
            href="https://en.wikipedia.org/wiki/Jaccard_index"
            className="text-accent hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            Jaccard similarity
          </a>{' '}
          across editions; a verse is flagged <em>materially divergent</em> when that
          minimum falls below {DIVERGENCE_THRESHOLD.toFixed(2)} (editions share under ~40%
          of significant vocabulary). This is a lexical measure — it captures both
          substantive and stylistic difference — so the per-pair score is always shown.
          With these early editions most verses diverge lexically; the measure sharpens
          as more, more-modern editions are added. The editions, their licences and the
          full method are recorded in the dataset&rsquo;s translations report.
        </p>
      </div>
    </details>
  );
}
