import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ReaderVerse } from '@/components/ReaderVerse';
import { parseSurahParam, surahHref } from '@/lib/addressing';
import { getBasmalaTokens, getSurah, getSurahVerses, listSurahs } from '@/server/corpus';

export function generateStaticParams(): { surah: string }[] {
  return listSurahs().map((s) => ({ surah: String(s.number) }));
}

interface Params {
  params: Promise<{ surah: string }>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { surah: surahParam } = await params;
  const number = parseSurahParam(surahParam);
  const surah = number ? getSurah(number) : undefined;
  if (!surah) return { title: 'Surah not found' };
  return {
    title: `${surah.name_en} (${surah.name_translit}) · Surah ${surah.number}`,
    description: `Surah ${surah.number}, ${surah.name_translit} — ${surah.name_en}. ${surah.verse_count} verses, ${surah.revelation_place}. Read every verse with each word addressable.`,
    alternates: { canonical: surahHref(surah.number) },
  };
}

export default async function SurahPage({ params }: Params) {
  const { surah: surahParam } = await params;
  const number = parseSurahParam(surahParam);
  const surah = number ? getSurah(number) : undefined;
  if (!surah || !number) notFound();

  const verses = getSurahVerses(number);
  const basmala = getBasmalaTokens(number);
  const prev = number > 1 ? getSurah(number - 1) : undefined;
  const next = number < 114 ? getSurah(number + 1) : undefined;

  return (
    <div className="mx-auto max-w-reader">
      <nav aria-label="Breadcrumb" className="mb-3 text-[13px] text-ink3">
        <a href="/" className="hover:text-ink2">
          Read
        </a>
        <span aria-hidden="true"> / </span>
        <span className="text-ink2">Surah {number}</span>
      </nav>

      <header className="mb-8 border-b border-line pb-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-semibold tracking-tight text-ink">
              {surah.name_en}{' '}
              <span className="font-normal text-ink3">· Surah {surah.number}</span>
            </h1>
            <p className="mt-1 text-[14px] text-ink2">
              {surah.name_translit} · {surah.revelation_place} · {surah.verse_count} verses
            </p>
          </div>
          <span lang="ar" dir="rtl" className="quran text-[34px] leading-none text-ink2">
            {surah.name_ar}
          </span>
        </div>
      </header>

      <div className="flex flex-col gap-4">
        {basmala ? (
          <ReaderVerse
            surahNumber={number}
            surahName={surah.name_en}
            tokens={basmala}
            from={0}
            mode="compact"
            basmala
          />
        ) : null}
        {verses.map((view) => (
          <ReaderVerse
            key={view.segment.id}
            surahNumber={number}
            surahName={surah.name_en}
            tokens={view.tokens}
            from={view.ordinal}
            mode="reading"
            showActions={false}
          />
        ))}
      </div>

      <nav aria-label="Surah navigation" className="mt-10 flex items-center justify-between gap-4">
        {prev ? (
          <a
            href={surahHref(prev.number)}
            className="rounded-lg border border-line bg-panel px-4 py-3 text-[14px] text-ink2 hover:border-line2"
            rel="prev"
          >
            ← {prev.number}. {prev.name_en}
          </a>
        ) : (
          <span />
        )}
        {next ? (
          <a
            href={surahHref(next.number)}
            className="rounded-lg border border-line bg-panel px-4 py-3 text-end text-[14px] text-ink2 hover:border-line2"
            rel="next"
          >
            {next.number}. {next.name_en} →
          </a>
        ) : (
          <span />
        )}
      </nav>
    </div>
  );
}
