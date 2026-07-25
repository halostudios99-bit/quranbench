import type { ReactNode } from 'react';

import type { Surah, Token } from '@quranbench/corpus';

import { surahAllHref, surahHref, surahPageHref } from '@/lib/addressing';
import { arabicScale, type ArabicSize, type DisplayMode } from '@/lib/reader-prefs';
import { getVerseTranslations, type VerseView } from '@/server/corpus';
import { ReaderVerse } from './ReaderVerse';
import { ReaderVerseBlock } from './ReaderVerseBlock';

// The surah reader, shared by the three surah surfaces: the continuous short
// surah and page 1 of a long one (`/2`), a subsequent page (`/2/page/3`), and
// the single-document view (`/2/all`). One component so the reader markup and
// its navigation never drift across them. Verses render through <ReaderVerse> —
// the single caller of the one verse renderer — with their licensed translations
// beneath, honouring the reader's display mode and Arabic size.

interface SurahReaderProps {
  surah: Surah;
  /** The verses to render on this surface (already sliced for the page). */
  verses: VerseView[];
  /** The separated opening basmala, shown on page 1 and the continuous views. */
  basmalaTokens: Token[] | null;
  variant: 'continuous' | 'paged' | 'all';
  page?: number;
  pageCount?: number;
  /** The reader controls (translations, display mode, size). */
  toolbar: ReactNode;
  /** Which editions to show beneath each verse; undefined shows all. */
  shownEditionIds: string[] | undefined;
  display: DisplayMode;
  size: ArabicSize;
}

export function SurahReader({
  surah,
  verses,
  basmalaTokens,
  variant,
  page = 1,
  pageCount = 1,
  toolbar,
  shownEditionIds,
  display,
  size,
}: SurahReaderProps) {
  const number = surah.number;
  const paged = variant === 'paged';
  const prevPageHref = page > 1 ? surahPageHref(number, page - 1) : null;
  const nextPageHref =
    paged && page < pageCount ? surahPageHref(number, page + 1) : null;
  const prevSurah = number > 1 ? number - 1 : null;
  const nextSurah = number < 114 ? number + 1 : null;
  const firstOrdinal = verses.length > 0 ? verses[0]!.ordinal : null;
  const lastOrdinal =
    verses.length > 0 ? verses[verses.length - 1]!.ordinal : null;

  return (
    <div
      className="mx-auto max-w-reader"
      data-reader-root
      style={{ ['--qb-arabic-scale' as string]: String(arabicScale(size)) }}
    >
      {/* rel=prev/next for paginated readers — hoisted to <head> by Next. */}
      {prevPageHref ? <link rel="prev" href={prevPageHref} /> : null}
      {nextPageHref ? <link rel="next" href={nextPageHref} /> : null}

      <nav aria-label="Breadcrumb" className="mb-3 text-[13px] text-ink3">
        <a href="/" className="hover:text-ink2">
          Read
        </a>
        <span aria-hidden="true"> / </span>
        {variant === 'continuous' ? (
          <span className="text-ink2">Surah {number}</span>
        ) : (
          <>
            <a href={surahHref(number)} className="hover:text-ink2">
              Surah {number}
            </a>
            <span aria-hidden="true"> / </span>
            <span className="text-ink2">
              {variant === 'all' ? 'Continuous' : `Page ${page}`}
            </span>
          </>
        )}
      </nav>

      <header className="mb-8 border-b border-line pb-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-semibold tracking-tight text-ink">
              {surah.name_en}{' '}
              <span className="font-normal text-ink3">
                · Surah {surah.number}
              </span>
            </h1>
            <p className="mt-1 text-[14px] text-ink2">
              {surah.name_translit} · {surah.revelation_place} ·{' '}
              {surah.verse_count} verses
            </p>
          </div>
          <span
            lang="ar"
            dir="rtl"
            className="quran text-[34px] leading-none text-ink2"
          >
            {surah.name_ar}
          </span>
        </div>

        {variant !== 'continuous' ? (
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-ink3">
            {paged ? (
              <span data-testid="page-indicator">
                Page {page} of {pageCount}
                {firstOrdinal && lastOrdinal ? (
                  <span className="text-ink2">
                    {' '}
                    · verses {firstOrdinal}–{lastOrdinal}
                  </span>
                ) : null}
              </span>
            ) : (
              <span>
                Continuous view · all {surah.verse_count} verses in one document
              </span>
            )}
            {variant === 'all' ? (
              <a
                href={surahHref(number)}
                className="text-accent hover:underline"
              >
                Back to paged reading
              </a>
            ) : (
              <a
                href={surahAllHref(number)}
                className="text-accent hover:underline"
                rel="nofollow"
              >
                Read continuously
              </a>
            )}
          </div>
        ) : null}
      </header>

      {toolbar}

      <div className="flex flex-col gap-4">
        {basmalaTokens ? (
          <ReaderVerse
            surahNumber={number}
            surahName={surah.name_en}
            tokens={basmalaTokens}
            from={0}
            mode="compact"
            basmala
          />
        ) : null}
        {verses.map((view) => (
          <ReaderVerseBlock
            key={view.segment.id}
            surahNumber={number}
            surahName={surah.name_en}
            tokens={view.tokens}
            ordinal={view.ordinal}
            display={display}
            translations={
              display === 'arabic'
                ? []
                : getVerseTranslations(view.segment.id, shownEditionIds)
            }
            mode="reading"
            showActions={false}
          />
        ))}
      </div>

      {paged ? (
        <nav
          aria-label="Surah pages"
          className="mt-10 flex items-center justify-between gap-4 border-t border-line pt-6"
        >
          {prevPageHref ? (
            <a
              href={prevPageHref}
              rel="prev"
              className="rounded-lg border border-line bg-panel px-4 py-3 text-[14px] text-ink2 hover:border-line2"
            >
              ← Page {page - 1}
            </a>
          ) : (
            <span />
          )}
          <span className="text-[13px] text-ink3">
            Page {page} of {pageCount}
          </span>
          {nextPageHref ? (
            <a
              href={nextPageHref}
              rel="next"
              className="rounded-lg border border-line bg-panel px-4 py-3 text-end text-[14px] text-ink2 hover:border-line2"
            >
              Page {page + 1} →
            </a>
          ) : (
            <span />
          )}
        </nav>
      ) : null}

      <nav
        aria-label="Surah navigation"
        className="mt-10 flex items-center justify-between gap-4"
      >
        {prevSurah ? (
          <a
            href={surahHref(prevSurah)}
            className="rounded-lg border border-line bg-panel px-4 py-3 text-[14px] text-ink2 hover:border-line2"
          >
            ← Surah {prevSurah}
          </a>
        ) : (
          <span />
        )}
        {nextSurah ? (
          <a
            href={surahHref(nextSurah)}
            className="rounded-lg border border-line bg-panel px-4 py-3 text-end text-[14px] text-ink2 hover:border-line2"
          >
            Surah {nextSurah} →
          </a>
        ) : (
          <span />
        )}
      </nav>
    </div>
  );
}
