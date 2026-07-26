import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { JsonLd } from '@/components/JsonLd';
import { OccurrenceChips } from '@/components/OccurrenceChips';
import { ProvenanceTag } from '@/components/ProvenanceTag';
import { glossHref, rootHref } from '@/lib/addressing';
import { absoluteUrl } from '@/lib/site';
import { describeGloss, getCorpus } from '@/server/corpus';

// Reverse gloss lookup: every Arabic word the Leeds QAC renders with one English
// gloss, grouped by root and lemma. ~thousands of distinct glosses, so on-demand
// ISR like word and root pages — nothing prebuilt, each cached on first request.
export const revalidate = 604800;
export const dynamicParams = true;

export function generateStaticParams(): { word: string }[] {
  return [];
}

// How many occurrences to show per lemma before summarising the rest — a common
// gloss can carry thousands of tokens and this keeps the page light.
const PER_LEMMA_LIMIT = 8;

interface Params {
  params: Promise<{ word: string }>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { word } = await params;
  const view = describeGloss(decodeURIComponent(word));
  if (!view) return { title: 'Gloss not found' };
  const { gloss, grouping } = view;
  return {
    title: `“${gloss}” — ${grouping.rootCount} root${grouping.rootCount === 1 ? '' : 's'}, ${grouping.total} occurrences`,
    description: `Every Arabic word the Quranic Arabic Corpus glosses as “${gloss}”: ${grouping.total} occurrence${grouping.total === 1 ? '' : 's'} across ${grouping.rootCount} distinct root${grouping.rootCount === 1 ? '' : 's'}. A computed reverse lookup — which different Arabic words are rendered the same way in English.`,
    alternates: { canonical: glossHref(view.key) },
  };
}

export default async function GlossPage({ params }: Params) {
  const { word } = await params;
  const requested = decodeURIComponent(word);
  const view = describeGloss(requested);
  if (!view) notFound();

  // Raw variants and non-canonical spellings redirect to the canonical slug, so a
  // gloss has one address whatever punctuation or bracket the reader arrived with.
  if (requested !== view.slug) redirect(glossHref(view.key));

  const { gloss, grouping, variants } = view;
  const corpusVersion = getCorpus().version;
  const canonical = absoluteUrl(glossHref(view.key));

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DefinedTerm',
    name: gloss,
    inLanguage: 'en',
    url: canonical,
    description: `Arabic words glossed “${gloss}” in the Quran: ${grouping.total} occurrences across ${grouping.rootCount} roots.`,
  };

  return (
    <div className="mx-auto max-w-reader">
      <JsonLd data={jsonLd} />

      <nav aria-label="Breadcrumb" className="mb-3 text-[13px] text-ink3">
        <a href="/" className="hover:text-ink2">
          Read
        </a>
        <span aria-hidden="true"> / </span>
        <span className="text-ink2">Glosses</span>
        <span aria-hidden="true"> / </span>
        <span className="text-ink2">“{gloss}”</span>
      </nav>

      <header className="mb-6 rounded-xl border border-line bg-panel px-5 py-7 sm:px-7">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <ProvenanceTag layer="external" note="Leeds QAC gloss (GPL)" />
          <span className="font-ui text-[13px] text-ink3">Reverse gloss lookup</span>
        </div>
        <h1 className="text-[30px] font-semibold leading-tight tracking-tight text-ink">
          “{gloss}”
        </h1>
        <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink2">
          <strong>{grouping.total}</strong> occurrence
          {grouping.total === 1 ? '' : 's'} across{' '}
          <strong>{grouping.rootCount}</strong> distinct root
          {grouping.rootCount === 1 ? '' : 's'} carry the English gloss{' '}
          <em>“{gloss}”</em>. This is a <strong>computed</strong> grouping of a{' '}
          <strong>word-level gloss</strong> from the Quranic Arabic Corpus — an
          external annotation, not a translation of any verse, and never Quranic
          text. Where more than one root appears below, those are different Arabic
          words rendered the same way in English.
        </p>

        {variants.length > 1 ? (
          <div className="mt-4 border-t border-line pt-4">
            <p className="font-ui text-[12px] uppercase tracking-wide text-ink3">
              Merged surface forms
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink2">
              {variants.length} verbatim gloss
              {variants.length === 1 ? '' : 'es'} from the corpus differ only by
              punctuation or bracketed helpers and are grouped here; each is shown
              exactly as written.
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {variants.map((v) => (
                <li
                  key={v.gloss}
                  className="rounded-full border border-line bg-soft px-2.5 py-0.5 font-ui text-[12px] text-ink2"
                >
                  <span>“{v.gloss}”</span>
                  <span className="ml-1.5 text-ink3">· {v.count}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </header>

      <div className="flex flex-col gap-4">
        {grouping.groups.map((group) => (
          <section
            key={group.rootSlug ?? 'no-root'}
            className="rounded-xl border border-line bg-panel px-5 py-5 sm:px-6"
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-3 text-[15px] font-semibold text-ink">
                {group.rootSlug && group.root ? (
                  <a
                    href={rootHref(group.rootSlug)}
                    className="flex items-center gap-2 hover:underline"
                  >
                    <span lang="ar" dir="rtl" className="quran text-[24px]">
                      {group.root}
                    </span>
                    <span className="font-ui text-[12px] text-ink3">
                      {group.rootSlug}
                    </span>
                  </a>
                ) : (
                  <span className="text-ink2">No triliteral root</span>
                )}
              </h2>
              <span className="font-ui text-[13px] text-ink3">
                {group.count} occurrence{group.count === 1 ? '' : 's'}
              </span>
            </div>

            <div className="flex flex-col gap-4">
              {group.lemmas.map((lemma, i) => (
                <div key={lemma.lemma ?? `lemma-${i}`}>
                  <div className="mb-2 flex items-center gap-2">
                    {lemma.lemma ? (
                      <span
                        lang="ar"
                        dir="rtl"
                        className="quran text-[20px] text-ink"
                      >
                        {lemma.lemma}
                      </span>
                    ) : (
                      <span className="font-ui text-[12px] uppercase tracking-wide text-ink3">
                        No lemma
                      </span>
                    )}
                    <span className="font-ui text-[12px] text-ink3">
                      · {lemma.count}
                    </span>
                  </div>
                  <OccurrenceChips items={lemma.refs.slice(0, PER_LEMMA_LIMIT)} />
                  {lemma.count > PER_LEMMA_LIMIT ? (
                    <p className="mt-2 font-ui text-[12px] text-ink3">
                      + {lemma.count - PER_LEMMA_LIMIT} more occurrence
                      {lemma.count - PER_LEMMA_LIMIT === 1 ? '' : 's'}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <footer className="mt-8 border-t border-line pt-5 text-[12px] leading-relaxed text-ink3">
        <p>
          Corpus v{corpusVersion}. Glosses are the word-by-word English renderings
          of the Quranic Arabic Corpus (Kais Dukes, Leeds), licensed
          GPL-2.0-or-later. Grouping and counts are computed over the loaded
          corpus; reproduce them by grouping <code>tokens.jsonl</code> on the{' '}
          <code>morphology.gloss</code> field. Canonical:{' '}
          <a href={canonical} className="hover:underline">
            {canonical}
          </a>
          .
        </p>
      </footer>
    </div>
  );
}
