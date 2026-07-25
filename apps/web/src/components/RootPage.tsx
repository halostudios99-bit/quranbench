import { CitingInvestigations } from '@/components/CitingInvestigations';
import { JsonLd } from '@/components/JsonLd';
import { ProvenanceTag } from '@/components/ProvenanceTag';
import { ReaderVerse } from '@/components/ReaderVerse';
import { VerseActions } from '@/components/VerseActions';
import { rootHref, rootOccurrencesHref } from '@/lib/addressing';
import type { ProvenanceLayer } from '@/lib/provenance';
import { absoluteUrl } from '@/lib/site';
import type { CitingInvestigation } from '@/server/domain/types';
import type {
  OccurrenceRef,
  RootOccurrencePage,
  RootView,
} from '@/server/corpus';

// The root page, shared by `/root/[slug]` (occurrence page 1) and
// `/root/[slug]/page/[n]`. The summary is identical on every page so each is a
// complete, self-contained, crawlable document; only the occurrence slice moves.
// Occurrences render through <ReaderVerse>, the one verse renderer.

interface RootPageProps {
  view: RootView;
  occurrences: RootOccurrencePage;
  edition: string;
  corpusVersion: string;
  citing: CitingInvestigation[];
}

function Section({
  title,
  provenance,
  note,
  children,
}: {
  title: string;
  provenance: ProvenanceLayer;
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

function RefLink({ o, label }: { o: OccurrenceRef; label: string }) {
  return (
    <a href={o.wordHref} className="text-accent hover:underline">
      <span lang="ar" dir="rtl" className="quran text-[22px]">
        {o.text}
      </span>
      <span className="ms-1.5 font-ui text-[12px] text-ink3">{label}</span>
    </a>
  );
}

export function RootPage({
  view,
  occurrences,
  edition,
  corpusVersion,
  citing,
}: RootPageProps) {
  const { root } = view;
  const slug = root.root_slug;
  const canonical = absoluteUrl(rootOccurrencesHref(slug, occurrences.page));
  const page = occurrences.page;
  const prevHref = page > 1 ? rootOccurrencesHref(slug, page - 1) : null;
  const nextHref =
    page < occurrences.pageCount ? rootOccurrencesHref(slug, page + 1) : null;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DefinedTermSet',
    name: `Root ${root.root}`,
    alternateName: slug,
    identifier: `root:${root.root}`,
    url: absoluteUrl(rootHref(slug)),
    inLanguage: 'ar',
    description: `The Quranic root ${root.root} (${view.transliteration}) — ${view.occurrences} occurrences across ${view.distinctForms} forms.`,
    hasDefinedTerm: view.forms.slice(0, 25).map((f) => ({
      '@type': 'DefinedTerm',
      name: f.form,
      url: absoluteUrl(f.representative.wordHref),
    })),
  };

  return (
    <div className="mx-auto max-w-reader">
      <JsonLd data={jsonLd} />
      {prevHref ? <link rel="prev" href={prevHref} /> : null}
      {nextHref ? <link rel="next" href={nextHref} /> : null}

      <nav aria-label="Breadcrumb" className="mb-3 text-[13px] text-ink3">
        <a href="/" className="hover:text-ink2">
          Read
        </a>
        <span aria-hidden="true"> / </span>
        <span className="text-ink2">Roots</span>
        <span aria-hidden="true"> / </span>
        {page > 1 ? (
          <>
            <a href={rootHref(slug)} className="hover:text-ink2">
              {root.root}
            </a>
            <span aria-hidden="true"> / </span>
            <span className="text-ink2">page {page}</span>
          </>
        ) : (
          <span className="text-ink2">{root.root}</span>
        )}
      </nav>

      <div
        data-verse-id={`root:${root.root}`}
        data-unit-type="root"
        data-url={absoluteUrl(rootHref(slug))}
        data-ref={`Root ${root.root}`}
        data-arabic-plain={root.root}
        className="mb-6 rounded-xl border border-line bg-panel px-5 py-7 sm:px-7"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ProvenanceTag layer="external" note="Leeds QAC (GPL)" />
            <span className="font-ui text-[13px] text-ink3">
              Root · {view.transliteration}
            </span>
          </div>
          <VerseActions unitType="root" />
        </div>
        <h1 className="mt-4">
          <span
            lang="ar"
            dir="rtl"
            className="quran block text-[44px] leading-tight text-ink sm:text-[52px]"
          >
            {root.root}
          </span>
        </h1>
      </div>

      <div className="flex flex-col gap-4">
        <Section title="Overview" provenance="computed">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <dt className="font-ui text-[12px] uppercase tracking-wide text-ink3">
                Occurrences
              </dt>
              <dd className="text-[22px] font-semibold text-ink">
                {view.occurrences}
              </dd>
            </div>
            <div>
              <dt className="font-ui text-[12px] uppercase tracking-wide text-ink3">
                Distinct forms
              </dt>
              <dd className="text-[22px] font-semibold text-ink">
                {view.distinctForms}
              </dd>
            </div>
            <div>
              <dt className="font-ui text-[12px] uppercase tracking-wide text-ink3">
                First
              </dt>
              <dd className="text-[14px]">
                <RefLink o={view.first} label={view.first.ref} />
              </dd>
            </div>
            <div>
              <dt className="font-ui text-[12px] uppercase tracking-wide text-ink3">
                Last
              </dt>
              <dd className="text-[14px]">
                <RefLink o={view.last} label={view.last.ref} />
              </dd>
            </div>
          </dl>
        </Section>

        <Section
          title={`Derived forms · ${view.distinctForms}`}
          provenance="external"
          note="Leeds QAC"
        >
          <ul className="flex flex-col divide-y divide-line">
            {view.forms.map((f) => (
              <li
                key={f.form}
                className="flex items-center justify-between gap-4 py-2"
              >
                <a href={f.representative.wordHref} className="hover:underline">
                  <span
                    lang="ar"
                    dir="rtl"
                    className="quran text-[26px] text-ink"
                  >
                    {f.form}
                  </span>
                </a>
                <span className="font-ui text-[13px] text-ink3">
                  {f.count} occurrence{f.count === 1 ? '' : 's'}
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Distribution across surahs" provenance="computed">
          <ul className="flex flex-col gap-1.5">
            {view.surahDistribution.map((s) => (
              <li key={s.surah} className="flex items-center gap-3">
                <a
                  href={`/${s.surah}`}
                  className="w-40 shrink-0 truncate font-ui text-[13px] text-ink2 hover:text-ink"
                >
                  {s.surah}. {s.name}
                </a>
                <span
                  className="flex h-4 flex-1 items-center"
                  aria-hidden="true"
                >
                  <span
                    className="block h-2 rounded-full bg-accent"
                    style={{
                      width: `${Math.max(2, (s.count / view.maxSurahCount) * 100)}%`,
                    }}
                  />
                </span>
                <span className="w-8 shrink-0 text-end font-ui text-[13px] text-ink3">
                  {s.count}
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Lemmas" provenance="external" note="Leeds QAC">
          <ul className="flex flex-wrap gap-2">
            {view.lemmas.map((l) => (
              <li key={l.lemma}>
                <a
                  href={l.representative.wordHref}
                  className="inline-flex items-center gap-2 rounded-lg border border-line bg-bg px-3 py-1.5 hover:border-line2"
                >
                  <span
                    lang="ar"
                    dir="rtl"
                    className="quran text-[22px] text-ink"
                  >
                    {l.lemma}
                  </span>
                  <span className="font-ui text-[12px] text-ink3">
                    {l.count}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </Section>

        <Section
          title={`Occurrences · ${occurrences.total} verse${occurrences.total === 1 ? '' : 's'}`}
          provenance="quran"
          note={edition}
        >
          <p className="mb-4 text-[13px] text-ink3">
            Page {occurrences.page} of {occurrences.pageCount}. The root is
            highlighted in each verse.
          </p>
          <div className="flex flex-col gap-4">
            {occurrences.items.map(({ view: v, highlight }) => (
              <ReaderVerse
                key={v.segmentId}
                surahNumber={v.surahNumber}
                surahName={v.surahName}
                tokens={v.tokens}
                from={v.ordinal ?? 0}
                mode="compact"
                basmala={v.basmala}
                highlightTokenIds={highlight}
              />
            ))}
          </div>

          {occurrences.pageCount > 1 ? (
            <nav
              aria-label="Occurrence pages"
              className="mt-6 flex items-center justify-between gap-4 border-t border-line pt-5"
            >
              {prevHref ? (
                <a
                  href={prevHref}
                  rel="prev"
                  className="rounded-lg border border-line bg-panel px-4 py-2.5 text-[14px] text-ink2 hover:border-line2"
                >
                  ← Page {page - 1}
                </a>
              ) : (
                <span />
              )}
              <span className="font-ui text-[13px] text-ink3">
                Page {page} of {occurrences.pageCount}
              </span>
              {nextHref ? (
                <a
                  href={nextHref}
                  rel="next"
                  className="rounded-lg border border-line bg-panel px-4 py-2.5 text-end text-[14px] text-ink2 hover:border-line2"
                >
                  Page {page + 1} →
                </a>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </Section>

        <CitingInvestigations items={citing} subject="this root" />
      </div>

      <footer className="mt-8 border-t border-line pt-5 text-[12px] leading-relaxed text-ink3">
        <p>
          Corpus v{corpusVersion} · text {edition} · root{' '}
          <code>root:{root.root}</code> ({view.transliteration}). Occurrence
          counts and the form and surah distributions are computed over the
          loaded corpus; the root assignment is Leeds QAC (GPL). Canonical:{' '}
          <a href={canonical} className="hover:underline">
            {canonical}
          </a>
          .
        </p>
      </footer>
    </div>
  );
}
