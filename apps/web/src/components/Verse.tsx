import type { Token as TokenRecord } from '@quranbench/corpus';

import type { UnitType } from '@/actions/registry';
import type { ProvenanceLayer } from '@/lib/provenance';
import { ProvenanceTag } from './ProvenanceTag';
import { Token } from './Token';
import { VerseActions } from './VerseActions';

// The ONE verse renderer. Everywhere a verse appears — reader, search result,
// evidence panel, basmala — it renders through this component, so every action
// and every provenance rule lives in one place and cannot drift across surfaces.
// If a surface needs different markup, add a mode; never duplicate this markup.

export type VerseMode = 'reading' | 'compact' | 'evidence' | 'result';

export interface VerseProps {
  /** Unit identifier, e.g. `quran:2:43`. */
  id: string;
  /** Canonical path — the no-JS permalink target. */
  href: string;
  /** Canonical absolute URL — the share target. */
  url: string;
  tokens: TokenRecord[];
  /** Human reference shown in the header, e.g. `Al-Baqarah 2:43`. */
  title: string;
  /** Short reference, e.g. `2:43`. */
  shortRef: string;
  /** Marker number rendered at the end of the line; omitted for the basmala. */
  ordinalLabel?: string | undefined;
  mode?: VerseMode;
  provenance?: ProvenanceLayer;
  provenanceNote?: string | undefined;
  unitType?: UnitType;
  edition: string;
  corpusVersion: string;
  /** Force actions on/off; defaults to on except in compact mode. */
  showActions?: boolean | undefined;
  /** Token ids to emphasise in the line — the subject word on a word or root page. */
  highlightTokenIds?: readonly string[] | undefined;
}

export function Verse({
  id,
  href,
  url,
  tokens,
  title,
  shortRef,
  ordinalLabel,
  mode = 'reading',
  provenance = 'quran',
  provenanceNote,
  unitType = 'verse',
  edition,
  corpusVersion,
  showActions,
  highlightTokenIds,
}: VerseProps) {
  const tokenSize = mode === 'compact' ? 'compact' : 'reading';
  const actionsOn = showActions ?? mode !== 'compact';
  const arabicPlain = tokens.map((t) => t.text_no_tashkeel).join(' ');
  const highlight = highlightTokenIds ? new Set(highlightTokenIds) : null;

  return (
    <article
      data-verse-id={id}
      data-mode={mode}
      data-unit-type={unitType}
      data-url={url}
      data-ref={title}
      data-short-ref={shortRef}
      data-edition={edition}
      data-corpus-version={corpusVersion}
      data-arabic-plain={arabicPlain}
      className="rounded-xl border border-line bg-panel px-5 py-6 sm:px-7 sm:py-7"
    >
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <a
            href={href}
            className="text-[14px] font-medium text-ink2 hover:text-ink"
            aria-label={`Permalink to ${title}`}
          >
            {mode === 'result' ? (
              <span className="text-ink">{title}</span>
            ) : (
              title
            )}
          </a>
          <ProvenanceTag layer={provenance} note={provenanceNote} />
        </div>
        {actionsOn ? <VerseActions unitType={unitType} /> : null}
      </header>

      <p
        dir="rtl"
        lang="ar"
        className="quran flex flex-wrap items-center gap-x-1 gap-y-1"
        data-testid="verse-line"
      >
        {tokens.map((token) => (
          <Token
            key={token.id}
            token={token}
            size={tokenSize}
            highlighted={highlight?.has(token.id) ?? false}
          />
        ))}
        {ordinalLabel ? (
          <span
            aria-hidden="true"
            data-provenance="computed"
            className="mx-1 inline-flex h-9 min-w-9 items-center justify-center rounded-full border border-line px-2 font-ui text-[13px] text-ink3"
          >
            {ordinalLabel}
          </span>
        ) : null}
      </p>
      <span className="sr-only">{`Reference ${shortRef}`}</span>
    </article>
  );
}
