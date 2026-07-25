import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ReactDOM from 'react-dom';

import { ReaderVerseBlock } from '@/components/ReaderVerseBlock';
import { resolveReaderView } from '@/components/reader-view';
import {
  parseAyahParam,
  parseSurahParam,
  rangeHref,
  referenceLabel,
  surahHref,
  verseHref,
} from '@/lib/addressing';
import { arabicScale } from '@/lib/reader-prefs';
import {
  getSurah,
  getSurahVerses,
  getVerseRange,
  getVerseTranslations,
  listTranslationEditions,
} from '@/server/corpus';

interface Params {
  params: Promise<{ surah: string; ayah: string }>;
}

function resolve(surahParam: string, ayahParam: string) {
  const number = parseSurahParam(surahParam);
  const range = parseAyahParam(ayahParam);
  if (!number || !range) return null;
  const surah = getSurah(number);
  if (!surah) return null;
  const views = getVerseRange(number, range.from, range.to);
  if (views.length === 0) return null;
  return { number, surah, from: range.from, to: range.to, views };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { surah: surahParam, ayah: ayahParam } = await params;
  const resolved = resolve(surahParam, ayahParam);
  if (!resolved) return { title: 'Verse not found' };
  const { number, surah, from, to } = resolved;
  const ref = referenceLabel(number, from, to);
  const canonical = rangeHref(number, from, to);
  const single = from === to;
  return {
    title: `${surah.name_en} ${ref}`,
    description: single
      ? `Quran ${ref} — ${surah.name_en} (${surah.name_translit}). Read the verse with every word addressable and each result reproducible.`
      : `Quran ${ref} — verses ${from}–${to} of ${surah.name_en} (${surah.name_translit}).`,
    alternates: { canonical },
  };
}

export default async function VersePage({ params }: Params) {
  const { surah: surahParam, ayah: ayahParam } = await params;
  const resolved = resolve(surahParam, ayahParam);
  if (!resolved) notFound();
  const { number, surah, from, to, views } = resolved;
  const single = from === to;
  const ref = referenceLabel(number, from, to);

  // LCP element on this route is the Arabic verse text: preload the subset.
  ReactDOM.preload('/fonts/amiri-quran.woff2', {
    as: 'font',
    type: 'font/woff2',
    crossOrigin: 'anonymous',
  });

  const editions = listTranslationEditions();
  const { toolbar, prefs } = await resolveReaderView(rangeHref(number, from, to));

  const all = getSurahVerses(number);
  const maxOrdinal = all.length > 0 ? all[all.length - 1]!.ordinal : from;
  const prevOrdinal = single && from > 1 ? from - 1 : null;
  const nextOrdinal = single && to < maxOrdinal ? to + 1 : null;

  return (
    <div
      className="mx-auto max-w-reader"
      data-reader-root
      style={{ ['--qb-arabic-scale' as string]: String(arabicScale(prefs.size)) }}
    >
      <nav aria-label="Breadcrumb" className="mb-3 text-[13px] text-ink3">
        <a href="/" className="hover:text-ink2">
          Read
        </a>
        <span aria-hidden="true"> / </span>
        <a href={surahHref(number)} className="hover:text-ink2">
          {surah.name_en}
        </a>
        <span aria-hidden="true"> / </span>
        <span className="text-ink2">{ref}</span>
      </nav>

      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-[22px] font-semibold tracking-tight text-ink">
          {surah.name_en} {ref}
          {!single ? (
            <span className="font-normal text-ink3">
              {' '}
              · verses {from}–{to}
            </span>
          ) : null}
        </h1>
        {editions.length > 0 ? (
          <a
            href={`/compare?v=${number}:${single ? from : `${from}-${to}`}`}
            className="text-[13px] text-accent hover:underline"
          >
            Compare editions →
          </a>
        ) : null}
      </header>

      {toolbar}

      <div className="flex flex-col gap-6">
        {views.map((view) => (
          <ReaderVerseBlock
            key={view.segment.id}
            surahNumber={number}
            surahName={surah.name_en}
            tokens={view.tokens}
            ordinal={view.ordinal}
            display={prefs.display}
            translations={
              prefs.display === 'arabic'
                ? []
                : getVerseTranslations(view.segment.id, prefs.editions)
            }
            mode="reading"
          />
        ))}
      </div>

      <nav
        aria-label="Verse navigation"
        className="mt-8 flex items-center justify-between gap-4"
      >
        {prevOrdinal ? (
          <a
            href={verseHref(number, prevOrdinal)}
            rel="prev"
            className="rounded-lg border border-line bg-panel px-4 py-3 text-[14px] text-ink2 hover:border-line2"
          >
            ← {number}:{prevOrdinal}
          </a>
        ) : (
          <span />
        )}
        <a
          href={surahHref(number)}
          className="text-[14px] text-ink3 hover:text-ink2"
        >
          All of {surah.name_en}
        </a>
        {nextOrdinal ? (
          <a
            href={verseHref(number, nextOrdinal)}
            rel="next"
            className="rounded-lg border border-line bg-panel px-4 py-3 text-[14px] text-ink2 hover:border-line2"
          >
            {number}:{nextOrdinal} →
          </a>
        ) : (
          <span />
        )}
      </nav>
    </div>
  );
}
