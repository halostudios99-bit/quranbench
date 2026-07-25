import type { Token as TokenRecord } from '@quranbench/corpus';

import { rangeHref, rangeId, referenceLabel, surahHref } from '@/lib/addressing';
import { absoluteUrl } from '@/lib/site';
import { getCorpus, getTextEdition } from '@/server/corpus';
import { Verse, type VerseMode } from './Verse';

// The single caller of <Verse>. Pages render verses, ranges, results and the
// surah-opening basmala through this one wrapper, which resolves addressing and
// provenance and then delegates to the one renderer. Keeping <Verse> to a single
// usage site is what stops verse markup drifting across surfaces.

interface ReaderVerseProps {
  surahNumber: number;
  surahName: string;
  tokens: TokenRecord[];
  from: number;
  to?: number;
  mode?: VerseMode;
  /** The separated surah-opening basmala: a token group, not a counted verse. */
  basmala?: boolean;
  /**
   * Override the renderer's action toolbar. The continuous surah reader turns it
   * off for a calm read (the header reference stays a permalink); the canonical
   * verse, range and search surfaces keep the full toolbar.
   */
  showActions?: boolean | undefined;
}

export function ReaderVerse({
  surahNumber,
  surahName,
  tokens,
  from,
  to,
  mode = 'reading',
  basmala = false,
  showActions,
}: ReaderVerseProps) {
  const edition = getTextEdition();
  const corpusVersion = getCorpus().version;
  const last = to ?? from;
  const isRange = !basmala && last > from;

  const shortRef = basmala ? 'basmala' : referenceLabel(surahNumber, from, last);
  const title = basmala ? `${surahName} · Basmala` : `${surahName} ${shortRef}`;
  const href = basmala ? surahHref(surahNumber) : rangeHref(surahNumber, from, last);
  const id = basmala ? `quran:${surahNumber}:basmala` : rangeId(surahNumber, from, last);

  return (
    <Verse
      id={id}
      href={href}
      url={absoluteUrl(href)}
      tokens={tokens}
      title={title}
      shortRef={shortRef}
      ordinalLabel={basmala || isRange ? undefined : String(from)}
      mode={mode}
      provenance="quran"
      provenanceNote={mode === 'reading' && !basmala ? edition : undefined}
      unitType={isRange ? 'range' : 'verse'}
      edition={edition}
      corpusVersion={corpusVersion}
      showActions={showActions}
    />
  );
}
