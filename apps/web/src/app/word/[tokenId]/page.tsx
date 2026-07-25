import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { JsonLd } from '@/components/JsonLd';
import { OccurrenceChips } from '@/components/OccurrenceChips';
import { ProvenanceTag } from '@/components/ProvenanceTag';
import { ReaderVerse } from '@/components/ReaderVerse';
import { VerseActions } from '@/components/VerseActions';
import { VerseTranslations } from '@/components/VerseTranslations';
import { rootHref, surahHref, verseHref, wordHref } from '@/lib/addressing';
import { absoluteUrl } from '@/lib/site';
import {
  describeToken,
  getCorpus,
  getTextEdition,
  getVerseTranslations,
} from '@/server/corpus';

// ~77,430 word pages: too many to statically generate, so on-demand ISR with a
// week-long revalidate. A page is built the first time it is requested, then
// served from cache. See docs/architecture.md §Rendering.
export const revalidate = 604800;
export const dynamicParams = true;

// No page is prebuilt (~77,430 is too many); every word page is generated on the
// first request and then cached until the revalidate window elapses. Exporting
// this — even empty — is what puts the route on the on-demand ISR path rather
// than rendering it fresh on every request.
export function generateStaticParams(): { tokenId: string }[] {
  return [];
}

interface Params {
  params: Promise<{ tokenId: string }>;
}

const POS_LABELS: Record<string, string> = {
  N: 'Noun',
  PN: 'Proper noun',
  V: 'Verb',
  ADJ: 'Adjective',
  PRON: 'Pronoun',
  DEM: 'Demonstrative',
  REL: 'Relative pronoun',
  P: 'Preposition',
  DET: 'Determiner',
  CONJ: 'Conjunction',
  ACC: 'Accusative particle',
  NEG: 'Negative particle',
  INTG: 'Interrogative',
  VOC: 'Vocative',
  T: 'Time adverb',
  LOC: 'Location adverb',
};

function posLabel(pos: string): string {
  return POS_LABELS[pos] ? `${POS_LABELS[pos]} (${pos})` : pos;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { tokenId } = await params;
  const view = describeToken(decodeURIComponent(tokenId));
  if (!view) return { title: 'Word not found' };
  const { token, surah, ref } = view;
  const rootPart = view.root ? ` · root ${view.root.root}` : '';
  return {
    title: `${token.text_uthmani} — Quran ${ref}${rootPart}`,
    description: `The word ${token.text_uthmani} (${token.text_no_tashkeel}) at Quran ${ref} in ${surah.name_en}. ${
      view.root ? `Root ${view.root.root}, ` : ''
    }${view.sameForm.total} occurrence${view.sameForm.total === 1 ? '' : 's'} of this exact form. Every form, position and morphology annotation shown with its source.`,
    alternates: { canonical: wordHref(token.id) },
  };
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="font-ui text-[12px] uppercase tracking-wide text-ink3">
        {label}
      </dt>
      <dd className="text-[14px] text-ink">{children}</dd>
    </div>
  );
}

function Section({
  title,
  provenance,
  note,
  children,
}: {
  title: string;
  provenance: 'quran' | 'computed' | 'external' | 'translation';
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line bg-panel px-5 py-5 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        <ProvenanceTag layer={provenance} note={note} />
      </div>
      {children}
    </section>
  );
}

export default async function WordPage({ params }: Params) {
  const { tokenId } = await params;
  const view = describeToken(decodeURIComponent(tokenId));
  if (!view) notFound();

  const { token, surah, ref, verseRef, ordinal, root, sameForm } = view;
  const morph = token.morphology;
  const edition = getTextEdition();
  const corpusVersion = getCorpus().version;
  // Verse-level: how each edition renders the whole verse containing this token.
  // A separated basmala is not a counted verse, so it has no translation line.
  const verseTranslations = getVerseTranslations(view.segmentId);
  const canonical = absoluteUrl(wordHref(token.id));
  const reference = `${surah.name_en} ${ref}`;
  const features = Object.entries(morph.features);

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'DefinedTerm',
    name: token.text_uthmani,
    alternateName: token.text_no_tashkeel,
    identifier: token.id,
    url: canonical,
    inLanguage: 'ar',
    isPartOf: { '@type': 'WebPage', url: absoluteUrl(view.verseHref) },
    ...(root
      ? {
          inDefinedTermSet: {
            '@type': 'DefinedTermSet',
            name: `Root ${root.root}`,
            url: absoluteUrl(rootHref(root.slug)),
          },
        }
      : {}),
  };

  return (
    <div className="mx-auto max-w-reader">
      <JsonLd data={jsonLd} />

      <nav aria-label="Breadcrumb" className="mb-3 text-[13px] text-ink3">
        <a href="/" className="hover:text-ink2">
          Read
        </a>
        <span aria-hidden="true"> / </span>
        <a href={surahHref(token.surah)} className="hover:text-ink2">
          {surah.name_en}
        </a>
        <span aria-hidden="true"> / </span>
        {ordinal !== null ? (
          <>
            <a
              href={verseHref(token.surah, ordinal)}
              className="hover:text-ink2"
            >
              {verseRef}
            </a>
            <span aria-hidden="true"> / </span>
          </>
        ) : null}
        <span className="text-ink2">word {token.position}</span>
      </nav>

      {/* Hero: the token itself and its action toolbar. Its own data-verse-id
          scope (unit type token) carries just this word for copy/cite/share. */}
      <div
        data-verse-id={token.id}
        data-unit-type="token"
        data-url={canonical}
        data-ref={reference}
        data-short-ref={ref}
        data-edition={edition}
        data-corpus-version={corpusVersion}
        data-arabic-plain={token.text_no_tashkeel}
        className="mb-6 rounded-xl border border-line bg-panel px-5 py-7 sm:px-7"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ProvenanceTag layer="quran" note={edition} />
            <span className="font-ui text-[13px] text-ink3">Quran {ref}</span>
          </div>
          <VerseActions unitType="token" />
        </div>
        <h1 className="mt-4">
          <span
            lang="ar"
            dir="rtl"
            data-token-id={token.id}
            className="quran block text-[40px] leading-tight text-ink sm:text-[44px]"
          >
            {token.text_uthmani}
          </span>
        </h1>
      </div>

      <div className="flex flex-col gap-4">
        <Section
          title="Forms"
          provenance="computed"
          note="derived from the Uthmani text"
        >
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Uthmani (as written)">
              <span
                lang="ar"
                dir="rtl"
                className="quran text-[26px] leading-normal"
              >
                {token.text_uthmani}
              </span>{' '}
              <ProvenanceTag layer="quran" className="align-middle" />
            </Field>
            <Field label="Simple">
              <span
                lang="ar"
                dir="rtl"
                className="quran text-[26px] leading-normal"
              >
                {token.text_simple}
              </span>
            </Field>
            <Field label="Without tashkeel">
              <span
                lang="ar"
                dir="rtl"
                className="quran text-[26px] leading-normal"
              >
                {token.text_no_tashkeel}
              </span>
            </Field>
            <Field label="Normalised (searchable)">
              <span
                lang="ar"
                dir="rtl"
                className="quran text-[26px] leading-normal"
              >
                {token.text_normalised}
              </span>
            </Field>
          </dl>
        </Section>

        <Section title="Position" provenance="computed">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label="Surah">
              <a
                href={surahHref(token.surah)}
                className="text-accent hover:underline"
              >
                {token.surah} · {surah.name_en}
              </a>
            </Field>
            <Field label="Verse">
              {ordinal !== null ? (
                <a
                  href={verseHref(token.surah, ordinal)}
                  className="text-accent hover:underline"
                >
                  {verseRef}
                </a>
              ) : (
                'Basmala'
              )}
            </Field>
            <Field label="Word in verse">{token.position}</Field>
            <Field label="Token id">
              <code className="break-all font-ui text-[12px] text-ink2">
                {token.id}
              </code>
            </Field>
          </dl>
        </Section>

        <Section
          title="Morphology"
          provenance="external"
          note="Leeds QAC (GPL)"
        >
          {morph.root || morph.lemma || morph.pos ? (
            <>
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Field label="Root">
                  {root ? (
                    <a
                      href={rootHref(root.slug)}
                      className="text-accent hover:underline"
                    >
                      <span lang="ar" dir="rtl" className="quran text-[22px]">
                        {root.root}
                      </span>
                      <span className="ms-2 font-ui text-[12px] text-ink3">
                        {root.slug}
                      </span>
                    </a>
                  ) : (
                    <span className="text-ink3">
                      none — this word has no triliteral root
                    </span>
                  )}
                </Field>
                <Field label="Lemma">
                  {morph.lemma ? (
                    <span lang="ar" dir="rtl" className="quran text-[22px]">
                      {morph.lemma}
                    </span>
                  ) : (
                    <span className="text-ink3">—</span>
                  )}
                </Field>
                <Field label="Part of speech">{posLabel(morph.pos)}</Field>
                <Field label="Features">
                  {features.length > 0 ? (
                    <span className="flex flex-wrap gap-1.5">
                      {features.map(([k, v]) => (
                        <span
                          key={k}
                          className="rounded border border-line px-1.5 py-0.5 font-ui text-[12px] text-ink2"
                        >
                          {k}: {String(v)}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="text-ink3">—</span>
                  )}
                </Field>
              </dl>

              <div className="mt-5">
                <p className="mb-2 font-ui text-[12px] uppercase tracking-wide text-ink3">
                  Sub-word segments
                </p>
                <ol className="flex flex-wrap gap-2" dir="rtl">
                  {morph.segments.map((seg, i) => (
                    <li
                      key={i}
                      className="rounded-lg border border-line bg-bg px-3 py-2 text-center"
                    >
                      <span
                        lang="ar"
                        dir="rtl"
                        className="quran block text-[22px] text-ink"
                      >
                        {seg.text}
                      </span>
                      <span className="mt-1 block font-ui text-[11px] text-ink3">
                        {seg.type} · {seg.pos}
                        {seg.root ? ` · ${seg.root}` : ''}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </>
          ) : (
            <p className="text-[14px] text-ink3">
              No morphological annotation for this token.
            </p>
          )}
          <p className="mt-4 text-[12px] leading-relaxed text-ink3">
            Morphology is an external annotation from the Leeds Quranic Arabic
            Corpus, licensed GPL-2.0-or-later. It is not Quranic text and never
            alters the token.
          </p>
        </Section>

        <Section title="In context" provenance="quran" note={edition}>
          <ReaderVerse
            surahNumber={token.surah}
            surahName={surah.name_en}
            tokens={view.verse.tokens}
            from={ordinal ?? 0}
            mode="compact"
            basmala={view.verse.basmala}
            highlightTokenIds={[token.id]}
          />
          {(view.prev || view.next) && (
            <div className="mt-4 flex items-center justify-between gap-3 font-ui text-[13px]">
              {view.prev ? (
                <a
                  href={view.prev.wordHref}
                  className="text-ink2 hover:text-ink"
                  rel="prev"
                >
                  ←{' '}
                  <span lang="ar" dir="rtl" className="quran text-[20px]">
                    {view.prev.text}
                  </span>{' '}
                  {view.prev.ref}
                </a>
              ) : (
                <span />
              )}
              {view.next ? (
                <a
                  href={view.next.wordHref}
                  className="text-ink2 hover:text-ink"
                  rel="next"
                >
                  <span lang="ar" dir="rtl" className="quran text-[20px]">
                    {view.next.text}
                  </span>{' '}
                  {view.next.ref} →
                </a>
              ) : (
                <span />
              )}
            </div>
          )}
        </Section>

        {verseTranslations.length > 0 ? (
          <Section
            title="How translators rendered it"
            provenance="translation"
            note={`${verseTranslations.length} edition${verseTranslations.length === 1 ? '' : 's'}`}
          >
            <p className="mb-3 text-[13px] text-ink2">
              These translations render <strong>verse {verseRef}</strong> — the
              whole verse this word appears in — not this word alone. The
              correspondence is <strong>verse-level</strong>: no word-level
              alignment of translations exists for these editions, so we do not
              claim which English word renders this Arabic word.{' '}
              <a href={`/compare?v=${verseRef}`} className="text-accent underline">
                Compare the editions →
              </a>
            </p>
            <VerseTranslations items={verseTranslations} />
          </Section>
        ) : null}

        <Section
          title={`Same form · ${sameForm.total} occurrence${sameForm.total === 1 ? '' : 's'}`}
          provenance="computed"
        >
          {sameForm.preview.length > 0 ? (
            <>
              <p className="mb-3 text-[14px] text-ink2">
                This exact written form{' '}
                <span lang="ar" dir="rtl" className="quran text-[22px]">
                  {token.text_uthmani}
                </span>{' '}
                appears {sameForm.total} time{sameForm.total === 1 ? '' : 's'}{' '}
                in the corpus.
              </p>
              <OccurrenceChips items={sameForm.preview} />
              {sameForm.hasMore ? (
                <a
                  href={`/search?q=${encodeURIComponent(`"${token.text_uthmani}"`)}`}
                  className="mt-3 inline-block text-[13px] text-accent hover:underline"
                >
                  View all {sameForm.total} occurrences in search →
                </a>
              ) : null}
            </>
          ) : (
            <p className="text-[14px] text-ink3">
              This exact form appears only here — it is a hapax in the corpus.
            </p>
          )}
        </Section>

        {root ? (
          <Section
            title={`Root ${root.root} · ${root.total} occurrence${root.total === 1 ? '' : 's'}`}
            provenance="external"
            note="Leeds QAC (GPL)"
          >
            <p className="mb-3 text-[14px] text-ink2">
              The root{' '}
              <a
                href={rootHref(root.slug)}
                className="text-accent hover:underline"
              >
                <span lang="ar" dir="rtl" className="quran text-[22px]">
                  {root.root}
                </span>
              </a>{' '}
              occurs {root.total} time{root.total === 1 ? '' : 's'} across{' '}
              {root.distinctForms} distinct form
              {root.distinctForms === 1 ? '' : 's'}.
            </p>
            {root.preview.length > 0 ? (
              <OccurrenceChips items={root.preview} />
            ) : null}
            <a
              href={rootHref(root.slug)}
              className="mt-3 inline-block text-[13px] text-accent hover:underline"
            >
              See the full root page for {root.root} →
            </a>
          </Section>
        ) : null}
      </div>

      <footer className="mt-8 border-t border-line pt-5 text-[12px] leading-relaxed text-ink3">
        <p>
          Corpus v{corpusVersion} · text {edition} · token id{' '}
          <code>{token.id}</code>. Counts are computed over the loaded corpus;
          morphology is Leeds QAC (GPL). Reproduce any figure by querying the
          same corpus version.
        </p>
      </footer>
    </div>
  );
}
