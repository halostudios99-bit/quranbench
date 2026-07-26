import type { TranslationEdition } from '@quranbench/corpus';

import { isGenerated } from '@/server/qb-edition';

import { ProvenanceTag } from './ProvenanceTag';

// Translations shown beneath the Arabic. Each is an external annotation layer,
// never scripture: rendered LTR in its own language, never with the `quran`
// class, and always labelled with translator, edition, year and licence. Every
// one carries the translation ProvenanceTag.
//
// One edition is not a human translation at all — the project's own, generated
// from the decision table. It is displayed under the same rules as the rest plus
// two more, because presenting a machine rendering as though a person had
// written it would be the single most misleading thing this page could do:
//
//   - its disclaimer is shown with the text, not hidden behind a link
//   - words whose decision is graded `judgement` are marked in place
//
// See server/qb-edition.ts and docs/translation-method.md (Rule 20).

export interface VerseTranslationItem {
  edition: TranslationEdition;
  text: string;
  /** Generated edition only: [start, length] spans into the split text. */
  judgement?: number[][];
}

interface VerseTranslationsProps {
  items: VerseTranslationItem[];
  /** Heading level context; defaults to a plain labelled list. */
  compact?: boolean;
}

/**
 * The text with its judgement spans marked. Returned as nodes rather than a
 * string so the marking cannot be mistaken for part of the rendering itself.
 */
function markJudgement(text: string, spans: number[][]) {
  const words = text.split(' ');
  const marked = new Map<number, number>();
  for (const [start, length] of spans) marked.set(start!, length!);

  const nodes: React.ReactNode[] = [];
  for (let i = 0; i < words.length; ) {
    const length = marked.get(i);
    if (length === undefined) {
      nodes.push(words[i]);
      i += 1;
      continue;
    }
    nodes.push(
      <mark
        key={i}
        className="bg-transparent text-ink underline decoration-dotted decoration-ink3 underline-offset-4"
        title="Graded judgement: this word rests on weaker evidence than the rest."
      >
        {words.slice(i, i + length).join(' ')}
      </mark>,
    );
    i += length;
  }

  return nodes.flatMap((node, i) => (i === 0 ? [node] : [' ', node]));
}

export function VerseTranslations({ items, compact = false }: VerseTranslationsProps) {
  if (items.length === 0) return null;
  return (
    <div className="mt-3 flex flex-col gap-3" data-testid="verse-translations">
      {items.map(({ edition, text, judgement }) => {
        const generated = isGenerated(edition);
        return (
          <figure
            key={edition.id}
            className="border-s-2 border-line ps-3"
            data-translation-edition={edition.id}
            data-generated={generated ? 'true' : undefined}
          >
            <blockquote
              lang={edition.language_code}
              dir="ltr"
              className={`text-ink ${compact ? 'text-[15px]' : 'text-[16px]'} leading-relaxed`}
            >
              {judgement?.length ? markJudgement(text, judgement) : text}
            </blockquote>
            {generated ? (
              <p
                className="mt-1.5 text-[12px] leading-relaxed text-ink3"
                data-testid="generated-disclaimer"
              >
                {edition.disclaimer}
              </p>
            ) : null}
            <figcaption className="mt-1.5 flex flex-wrap items-center gap-2 text-[12px] text-ink3">
              <ProvenanceTag
                layer="translation"
                note={
                  generated
                    ? `${edition.translator} — not a human translation`
                    : `${edition.translator} (${edition.year})`
                }
                {...(generated
                  ? {
                      title:
                        'Generated from this project\u2019s decision table. Not a human translation.',
                    }
                  : {})}
              />
              {/* A licence chip in a metadata row, not a link inside a sentence:
                  it measured 19px tall, below the 24px target minimum. */}
              <a
                href={edition.licence_url}
                target="_blank"
                rel="noreferrer"
                className="inline-block py-1 hover:text-ink2"
              >
                {edition.licence}
              </a>
              {generated ? (
                <a href="/method" className="inline-block py-1 hover:text-ink2">
                  How this was produced
                </a>
              ) : null}
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}
