import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { SurahReader } from '@/components/SurahReader';
import { parseSurahParam } from '@/lib/addressing';
import { getBasmalaTokens, getSurah, getSurahVerses } from '@/server/corpus';

interface Params {
  params: Promise<{ surah: string }>;
}

// The whole-surah, single-document view. Kept available for anyone who wants to
// read or search a long surah in one page, but `noindex`: the paginated pages
// are the canonical, crawlable surface (design-system §6).
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { surah: surahParam } = await params;
  const number = parseSurahParam(surahParam);
  const surah = number ? getSurah(number) : undefined;
  if (!surah) return { title: 'Surah not found' };
  return {
    title: `${surah.name_en} · Surah ${surah.number} · continuous`,
    robots: { index: false, follow: true },
  };
}

export default async function SurahAllPage({ params }: Params) {
  const { surah: surahParam } = await params;
  const number = parseSurahParam(surahParam);
  const surah = number ? getSurah(number) : undefined;
  if (!surah || !number) notFound();

  return (
    <SurahReader
      surah={surah}
      verses={getSurahVerses(number)}
      basmalaTokens={getBasmalaTokens(number)}
      variant="all"
    />
  );
}
