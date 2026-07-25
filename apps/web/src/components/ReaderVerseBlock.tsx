import type { Token } from '@quranbench/corpus';

import { verseHref } from '@/lib/addressing';
import type { DisplayMode } from '@/lib/reader-prefs';
import { ReaderVerse } from './ReaderVerse';
import { VerseTranslations, type VerseTranslationItem } from './VerseTranslations';

// One verse as the reader sees it, under a display mode: Arabic only, Arabic +
// translation, or translation only. Composes the single verse renderer with the
// translation layer so the three reader surfaces (surah, paginated, single verse)
// apply the display mode identically. Every mode renders complete server-side HTML.

interface ReaderVerseBlockProps {
  surahNumber: number;
  surahName: string;
  tokens: Token[];
  /** Verse ordinal under the active scheme; null for a separated basmala. */
  ordinal: number | null;
  display: DisplayMode;
  translations: VerseTranslationItem[];
  mode?: 'reading' | 'compact';
  basmala?: boolean;
  showActions?: boolean | undefined;
}

export function ReaderVerseBlock({
  surahNumber,
  surahName,
  tokens,
  ordinal,
  display,
  translations,
  mode = 'reading',
  basmala = false,
  showActions,
}: ReaderVerseBlockProps) {
  // Translation-only: skip the Arabic tokens but keep the verse addressable with a
  // reference link, then show the translations. A separated basmala has no ordinal,
  // so it always renders its Arabic (there is nothing to translate).
  if (display === 'translation' && !basmala && ordinal !== null) {
    return (
      <div>
        <a
          href={verseHref(surahNumber, ordinal)}
          className="font-ui text-[13px] font-semibold text-ink2 hover:text-ink"
        >
          {surahNumber}:{ordinal}
        </a>
        <VerseTranslations items={translations} />
      </div>
    );
  }

  return (
    <div>
      <ReaderVerse
        surahNumber={surahNumber}
        surahName={surahName}
        tokens={tokens}
        from={ordinal ?? 0}
        mode={mode}
        basmala={basmala}
        showActions={showActions}
      />
      {display !== 'arabic' && !basmala ? (
        <VerseTranslations items={translations} />
      ) : null}
    </div>
  );
}
