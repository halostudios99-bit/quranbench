import type { Metadata } from 'next';

import { ProvenanceTag } from '@/components/ProvenanceTag';
import type { Source } from '@quranbench/corpus';
import { currentVersion, readManifest } from '@/server/artifacts';
import {
  CO_OCCURRENCE_LIMIT,
  SIMILARITY_STOPLIST_MIN_DF,
  SIMILAR_VERSES_LIMIT,
  similarityStoplist,
} from '@/server/corpus';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { artifactsRoot } from '@/server/artifacts';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'Method',
  description:
    'How the quranbench corpus is built: which text edition and morphology source, how normalisation works, how the basmala and numbering are handled, what is computed versus asserted, how to reproduce any figure, and the known limitations.',
  alternates: { canonical: '/method' },
};

function sources(version: string): Source[] {
  const path = join(artifactsRoot(), `v${version}`, 'sources.json');
  return JSON.parse(readFileSync(path, 'utf8')) as Source[];
}

function Section({
  title,
  provenance,
  children,
}: {
  title: string;
  provenance?: 'quran' | 'computed' | 'external' | 'translation' | 'editorial';
  children: React.ReactNode;
}) {
  return (
    <section className="mb-9">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 className="text-[18px] font-semibold text-ink">{title}</h2>
        {provenance ? <ProvenanceTag layer={provenance} /> : null}
      </div>
      <div className="flex flex-col gap-3 text-[15px] leading-relaxed text-ink2">
        {children}
      </div>
    </section>
  );
}

export default function MethodPage() {
  const version = currentVersion();
  const manifest = readManifest(version);
  const src = sources(version);
  const text = src.find((s) => s.id === 'tanzil-uthmani');
  const morph = src.find((s) => s.id === 'leeds-qac-morphology');
  const translations = src.filter((s) => s.role === 'translation');
  const rules = manifest.normalisation_rules;
  const stoplist = similarityStoplist();

  return (
    <article className="mx-auto max-w-reader">
      <header className="mb-8">
        <div className="mb-3">
          <ProvenanceTag layer="editorial" note={`describes v${version}`} />
        </div>
        <h1 className="text-[26px] font-semibold tracking-tight text-ink">
          How this is built
        </h1>
        <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink2">
          Do not accept our interpretation. This page tells you exactly where
          every field comes from, what we compute, what we merely assert, and
          where the edges are — so you can reproduce any figure on the site and
          judge it for yourself.
        </p>
      </header>

      <Section title="The text edition" provenance="quran">
        <p>
          The Arabic is the <strong>{text?.name ?? 'Tanzil Uthmani'}</strong> (
          {text?.edition}), published by the{' '}
          {text?.publisher ?? 'Tanzil Project'} under{' '}
          <strong>{text?.licence ?? 'CC-BY-3.0'}</strong>. It is the immutable
          source of truth. We never modify Quranic text: normalised,
          tashkeel-stripped and segmented forms are stored as separate labelled
          fields, and the source text is always attributed to Tanzil.
        </p>
        <p>
          Its sha256 is recorded in the manifest, so you can confirm the exact
          bytes we ingested:
        </p>
        <code className="break-all rounded-lg border border-line bg-panel px-3 py-2 font-ui text-[12px] text-ink3">
          {text?.sha256}
        </code>
      </Section>

      <Section title="The morphology source" provenance="external">
        <p>
          Root, lemma, part-of-speech and sub-word segmentation come from the{' '}
          <strong>{morph?.name ?? 'Leeds Quranic Arabic Corpus'}</strong>,
          licensed <strong>{morph?.licence ?? 'GPL-2.0-or-later'}</strong>. This
          is an <em>external annotation</em>. It never alters a token&rsquo;s
          id, position or text, and it carries its own copyleft licence — which
          is why the tokenised <code>tokens.jsonl</code> is distributed under
          the GPL while the plain text stays CC-BY.
        </p>
        <p>
          Each token records how the Leeds word aligned onto it, so a
          questionable annotation is traceable rather than anonymous.
        </p>
      </Section>

      <Section title="How normalisation works" provenance="computed">
        <p>
          Search runs over a normalised form derived from the Uthmani text by a
          fixed, disclosed set of rules. Normalisation only ever produces a{' '}
          <em>new labelled field</em> — it never rewrites the source.
        </p>
        <ol className="flex flex-col gap-2">
          {rules.map((rule) => (
            <li
              key={rule.id}
              className="rounded-lg border border-line bg-panel px-3 py-2"
            >
              <span className="font-ui text-[12px] text-ink3">{rule.id}</span>
              <p className="text-[14px] text-ink2">{rule.description}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="The basmala" provenance="computed">
        <p>
          The basmala is handled as <strong>{manifest.basmala_handling}</strong>
          : in most surahs it is a separated opening, stored as its own token
          group that is <em>not</em> a counted verse row. Surah 1 counts it as a
          verse; surah 9 has none. Because it is a parameter, a computation
          discloses whether it counts the basmala (<code>basmala=1</code> or{' '}
          <code>0</code>) rather than baking one choice in.
        </p>
      </Section>

      <Section title="Numbering is a parameter" provenance="computed">
        <p>
          Verse numbering is a recorded parameter, not a fact baked into
          identifiers. The active scheme is{' '}
          <strong>{manifest.numbering.active}</strong> (
          {manifest.numbering.verse_counts[manifest.numbering.active]} counted
          verses). Each scheme is a data file; the active scheme&rsquo;s counted
          segments are the rows of <code>verses.jsonl</code>. An identifier is
          scheme-qualified, so it means the same thing regardless of which
          scheme you view under.
        </p>
      </Section>

      <Section title="Computed versus asserted" provenance="computed">
        <p>
          <strong>Computed</strong>: every count, frequency, form list, root
          distribution and search result. These are derived deterministically
          from the loaded corpus and carry the exact parameters that produced
          them. Re-running the same query on the same version gives the same
          number.
        </p>
        <p>
          <strong>Asserted from an external source</strong>: the morphology
          (Leeds QAC) and the human translation editions. We attribute these,
          never present them as our own computation, and never present them as
          Quranic text.
        </p>
        <p>
          <strong>Asserted by us (editorial)</strong>: investigations and notes.
          These are labelled editorial and are the only layer that is our
          opinion.
        </p>
      </Section>

      <Section title="How to reproduce any figure">
        <p>
          Every number on the site links to the query and version that produced
          it. To reproduce one independently:
        </p>
        <ol className="ms-4 flex list-decimal flex-col gap-1 text-[14px]">
          <li>
            Download the corpus version from{' '}
            <a href="/data" className="text-accent underline">
              /data
            </a>{' '}
            and verify its sha256.
          </li>
          <li>
            Re-run the query against the API — for example{' '}
            <code className="font-ui text-[12px]">
              /api/v1/search?q=root:z-k-w
            </code>
            . The response echoes the parsed query, the corpus version and the
            computation parameters.
          </li>
          <li>Compare the total to what the page shows. They must match.</li>
        </ol>
      </Section>

      <section id="similar-verses" className="mb-9 scroll-mt-20">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="text-[18px] font-semibold text-ink">
            Similar verses — the measure
          </h2>
          <ProvenanceTag layer="computed" />
        </div>
        <div className="flex flex-col gap-3 text-[15px] leading-relaxed text-ink2">
          <p>
            On a single verse page, the <strong>{SIMILAR_VERSES_LIMIT}</strong> most
            similar verses are ranked by the <strong>Jaccard index</strong> of the
            two verses&rsquo; sets of morphological roots:{' '}
            <code>J(A, B) = |A ∩ B| / |A ∪ B|</code>. Jaccard is symmetric and
            bounded in [0, 1], and — unlike a raw shared-root count — is not inflated
            by verse length, so a short verse and a long one are compared fairly. Only
            verses that share at least one root are candidates, gathered through the
            root&rarr;verses index, so the cost is bounded by the target verse&rsquo;s
            roots rather than the whole corpus.
          </p>
          <p>
            Before the measure runs, a <strong>stoplist</strong> of ubiquitous roots
            is removed from every verse&rsquo;s set. A root that occurs in a large
            fraction of verses carries no discriminating signal: left in, it would
            make almost every verse look similar to every other. The stoplist is
            defined precisely and reproducibly as{' '}
            <em>
              every root occurring in {SIMILARITY_STOPLIST_MIN_DF} or more distinct
              verses
            </em>
            . In v{version} that is these {stoplist.length} roots:
          </p>
          <ul className="flex flex-wrap gap-2">
            {stoplist.map((r) => (
              <li
                key={r.slug}
                className="rounded-lg border border-line bg-panel px-3 py-1.5"
              >
                <span lang="ar" dir="rtl" className="quran text-[20px] text-ink">
                  {r.root}
                </span>
                <span className="ms-2 font-ui text-[12px] text-ink3">{r.slug}</span>
              </li>
            ))}
          </ul>
          <p>
            The score and the exact shared roots are shown on every result, so you can
            see what drove the ranking and disagree with it. Verses stoplisted out of
            the target are listed too. The computation is per-request over the loaded
            corpus and stays within budget; no similarity is precomputed.
          </p>
        </div>
      </section>

      <section id="co-occurrence" className="mb-9 scroll-mt-20">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="text-[18px] font-semibold text-ink">
            Root co-occurrence — connected roots
          </h2>
          <ProvenanceTag layer="computed" />
        </div>
        <div className="flex flex-col gap-3 text-[15px] leading-relaxed text-ink2">
          <p>
            On a root page, the <strong>{CO_OCCURRENCE_LIMIT}</strong> most connected
            roots are shown. <strong>Window:</strong> the verse — two roots co-occur
            when they appear in the same counted verse. <strong>Measure:</strong> the
            number of distinct verses in which both roots occur. Raw shared-verse
            count is used rather than an association score because it is stable, needs
            no smoothing for rare roots, and reproduces exactly from{' '}
            <code>tokens.jsonl</code>.
          </p>
          <p>
            The same stoplist above is applied to the <em>results</em> (not to the
            subject root), so the list surfaces genuinely connected concepts rather
            than the same handful of ubiquitous roots under every entry. Separated
            basmalas are excluded, as they are not counted verses.
          </p>
        </div>
      </section>

      <Section title="Known limitations">
        <p>This page is worth more than any feature, so it is blunt:</p>
        <ul className="ms-4 flex list-disc flex-col gap-2 text-[14px]">
          <li>
            <strong>Verse slot labels remain Kufan-derived.</strong> The counted
            verse rows follow the Kufan tradition. Other counting traditions
            exist and are modelled as alternative schemes, but the default slots
            are Kufan and should not be read as tradition-neutral.
          </li>
          <li>
            <strong>Translation alignment is verse-level only.</strong> The{' '}
            {translations.length} translation editions align to the Arabic by
            verse identifier, never word-for-word. Word-level alignment data
            does not exist for these editions and is never fabricated — we do
            not claim which English word renders which Arabic word.
          </li>
          <li>
            <strong>Morphology is a third-party annotation.</strong> The Leeds
            corpus is a scholarly reconstruction with its own editorial choices;
            disagreements with it are legitimate and traceable to the aligned
            source.
          </li>
          <li>
            <strong>
              Token <code>text_simple</code> is computed, not sourced.
            </strong>{' '}
            It is derived from the Uthmani text because the Simple edition does
            not tokenise word-for-word — see the <code>to-simple</code>{' '}
            normalisation rule above.
          </li>
        </ul>
      </Section>

      <section id="generated-edition" className="mb-9 scroll-mt-20">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="text-[18px] font-semibold text-ink">
            The generated translation
          </h2>
        </div>
        <div className="flex max-w-prose flex-col gap-3 text-[15px] leading-relaxed text-ink2">
          <p>
            One edition in the reader — <em>QuranBench (generated)</em> — is
            not a human translation. It is produced from a table of word-by-word
            decisions: each Arabic word (by root, lemma and part of speech)
            maps to one English rendering, decided from how the word is used
            across the whole text, and the build substitutes those decisions
            verse by verse. Arabic word order is preserved. No language model
            writes any of it, and no tafsir, hadith or existing translation was
            consulted; the machine indexes and substitutes, a person decides.
          </p>
          <p>
            Every decision carries a grade. <em>Settled</em> means the text
            itself fixes the sense; <em>supported</em> means the evidence is
            thinner; <em>judgement</em> means the word occurs once in the Quran
            and its rendering rests on general Arabic rather than the corpus.
            Judgement words are underlined in the reader, and the full list is
            reviewable at{' '}
            <a href="/review" className="text-accent underline">
              /review
            </a>
            . The edition is hash-locked to the exact decision table that
            produced it, so identical inputs always yield an identical text.
          </p>
          <p>
            The complete method — twenty-two rules, each named for the error it
            prevents — is in the repository as{' '}
            <code>docs/translation-method.md</code>.
          </p>
        </div>
      </section>

      <footer className="mt-10 border-t border-line pt-5 text-[13px] leading-relaxed text-ink3">
        <p>
          This page describes corpus v{version}. The definitive,
          machine-readable record is the{' '}
          <a href="/api/v1/manifest" className="text-accent underline">
            manifest
          </a>
          ; every claim here is drawn from it.
        </p>
      </footer>
    </article>
  );
}
