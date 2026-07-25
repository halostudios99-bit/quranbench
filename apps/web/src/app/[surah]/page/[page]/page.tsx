import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { SurahReader } from '@/components/SurahReader';
import { parseSurahParam, surahHref, surahPageHref } from '@/lib/addressing';
import {
  isPaginatedSurah,
  pageSlice,
  parsePageParam,
  surahPageCount,
  VERSES_PER_PAGE,
} from '@/lib/pagination';
import { getSurah, getSurahVerses, listSurahs } from '@/server/corpus';

// The paginated pages are bounded (only long surahs, ~a few hundred pages in
// total), so they are prerendered — every crawlable reader page is static HTML.
export function generateStaticParams(): { surah: string; page: string }[] {
  const params: { surah: string; page: string }[] = [];
  for (const s of listSurahs()) {
    const pages = surahPageCount(s.verse_count);
    for (let p = 2; p <= pages; p++)
      params.push({ surah: String(s.number), page: String(p) });
  }
  return params;
}

interface Params {
  params: Promise<{ surah: string; page: string }>;
}

function resolve(surahParam: string, pageParam: string) {
  const number = parseSurahParam(surahParam);
  const page = parsePageParam(pageParam);
  if (!number || page === null) return null;
  const surah = getSurah(number);
  if (!surah || !isPaginatedSurah(surah.verse_count)) return null;
  const pageCount = surahPageCount(surah.verse_count);
  if (page > pageCount) return null;
  return { number, surah, page, pageCount };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { surah: surahParam, page: pageParam } = await params;
  const resolved = resolve(surahParam, pageParam);
  if (!resolved) return { title: 'Page not found' };
  const { number, surah, page, pageCount } = resolved;
  return {
    title: `${surah.name_en} · Surah ${number} · page ${page} of ${pageCount}`,
    description: `Surah ${number}, ${surah.name_translit} — page ${page} of ${pageCount}. Server-rendered, every word addressable.`,
    alternates: { canonical: surahPageHref(number, page) },
  };
}

export default async function SurahPagePage({ params }: Params) {
  const { surah: surahParam, page: pageParam } = await params;
  // A `/page/1` (or malformed) request has no distinct content — send it to the
  // canonical bare surah page rather than serving a duplicate.
  const number = parseSurahParam(surahParam);
  if (number && /^\d+$/.test(pageParam) && Number(pageParam) <= 1)
    redirect(surahHref(number));

  const resolved = resolve(surahParam, pageParam);
  if (!resolved) notFound();
  const { surah, page, pageCount } = resolved;

  const all = getSurahVerses(surah.number);
  const { start, end } = pageSlice(page, VERSES_PER_PAGE);
  return (
    <SurahReader
      surah={surah}
      verses={all.slice(start, end)}
      basmalaTokens={null}
      variant="paged"
      page={page}
      pageCount={pageCount}
    />
  );
}
