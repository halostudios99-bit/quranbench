import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { SurahReader } from '@/components/SurahReader';
import { parseSurahParam, surahHref } from '@/lib/addressing';
import {
  isPaginatedSurah,
  pageSlice,
  surahPageCount,
  VERSES_PER_PAGE,
} from '@/lib/pagination';
import {
  getBasmalaTokens,
  getSurah,
  getSurahVerses,
  listSurahs,
} from '@/server/corpus';

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
  const paged = isPaginatedSurah(surah.verse_count);
  const pageCount = surahPageCount(surah.verse_count);
  return {
    title: `${surah.name_en} (${surah.name_translit}) · Surah ${surah.number}`,
    description: paged
      ? `Surah ${surah.number}, ${surah.name_translit} — ${surah.name_en}. ${surah.verse_count} verses across ${pageCount} pages, ${surah.revelation_place}. Every word addressable and every result reproducible.`
      : `Surah ${surah.number}, ${surah.name_translit} — ${surah.name_en}. ${surah.verse_count} verses, ${surah.revelation_place}. Read every verse with each word addressable.`,
    alternates: { canonical: surahHref(surah.number) },
  };
}

export default async function SurahPage({ params }: Params) {
  const { surah: surahParam } = await params;
  const number = parseSurahParam(surahParam);
  const surah = number ? getSurah(number) : undefined;
  if (!surah || !number) notFound();

  const all = getSurahVerses(number);
  const basmala = getBasmalaTokens(number);

  if (!isPaginatedSurah(surah.verse_count)) {
    return (
      <SurahReader
        surah={surah}
        verses={all}
        basmalaTokens={basmala}
        variant="continuous"
      />
    );
  }

  const pageCount = surahPageCount(surah.verse_count);
  const { start, end } = pageSlice(1, VERSES_PER_PAGE);
  return (
    <SurahReader
      surah={surah}
      verses={all.slice(start, end)}
      basmalaTokens={basmala}
      variant="paged"
      page={1}
      pageCount={pageCount}
    />
  );
}
