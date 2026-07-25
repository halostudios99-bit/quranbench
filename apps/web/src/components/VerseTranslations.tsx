import type { TranslationEdition } from '@quranbench/corpus';

import { ProvenanceTag } from './ProvenanceTag';

// Translations shown beneath the Arabic. Each is a licensed human edition — an
// external annotation layer, never scripture: rendered LTR in its own language,
// never with the `quran` class, and always labelled with translator, edition,
// year and licence. Every one carries the translation ProvenanceTag.

export interface VerseTranslationItem {
  edition: TranslationEdition;
  text: string;
}

interface VerseTranslationsProps {
  items: VerseTranslationItem[];
  /** Heading level context; defaults to a plain labelled list. */
  compact?: boolean;
}

export function VerseTranslations({ items, compact = false }: VerseTranslationsProps) {
  if (items.length === 0) return null;
  return (
    <div className="mt-3 flex flex-col gap-3" data-testid="verse-translations">
      {items.map(({ edition, text }) => (
        <figure
          key={edition.id}
          className="border-s-2 border-line ps-3"
          data-translation-edition={edition.id}
        >
          <blockquote
            lang={edition.language_code}
            dir="ltr"
            className={`text-ink ${compact ? 'text-[15px]' : 'text-[16px]'} leading-relaxed`}
          >
            {text}
          </blockquote>
          <figcaption className="mt-1.5 flex flex-wrap items-center gap-2 text-[12px] text-ink3">
            <ProvenanceTag
              layer="translation"
              note={`${edition.translator} (${edition.year})`}
            />
            <a
              href={edition.licence_url}
              target="_blank"
              rel="noreferrer"
              className="hover:text-ink2"
            >
              {edition.licence}
            </a>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
