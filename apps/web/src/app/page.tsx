import type { Metadata } from 'next';

import { JsonLd } from '@/components/JsonLd';
import { ReaderVerse } from '@/components/ReaderVerse';
import { SearchBar } from '@/components/SearchBar';
import { SurahIndex } from '@/components/SurahIndex';
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from '@/lib/site';
import { getCorpus, getSurah, getVerse } from '@/server/corpus';

// The homepage is the page most likely to be linked with tracking parameters, so
// it needs the canonical every other page type already has.
export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

export default function HomePage() {
  const corpus = getCorpus();
  const surah = getSurah(2);
  const sample = getVerse(2, 43);
  const words = corpus.tokens.length.toLocaleString('en-US');
  const roots = corpus.roots.length.toLocaleString('en-US');

  // Word, root, gloss and data pages already carry JSON-LD; the homepage did not,
  // so nothing declared what this site *is*. WebSite + SearchAction is what makes
  // a search box eligible in results; the Organization is deliberately the project
  // and not a person, because the maintainer's name is still undecided and nothing
  // in this codebase may assert one.
  const structured = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        description: SITE_TAGLINE,
        inLanguage: 'en',
        publisher: { '@id': `${SITE_URL}/#organization` },
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        description:
          'An open Quran research workbench. Every Arabic word is a permanent, addressable research object.',
      },
      {
        '@type': 'Dataset',
        '@id': `${SITE_URL}/data#dataset`,
        name: `${SITE_NAME} Quran corpus`,
        description: `A versioned, checksummed Quran token corpus: ${words} tokens and ${roots} roots, with morphology, glosses and public-domain translations.`,
        url: `${SITE_URL}/data`,
        isAccessibleForFree: true,
        creator: { '@id': `${SITE_URL}/#organization` },
      },
    ],
  };

  return (
    <div className="flex flex-col gap-16">
      <JsonLd data={structured} />
      <section className="pt-4">
        <h1 className="max-w-3xl text-[32px] font-semibold leading-tight tracking-tight text-ink sm:text-[40px]">
          {SITE_TAGLINE}
        </h1>
        <p className="mb-8 mt-3 max-w-xl text-[17px] text-ink2">
          Every word, every root, every occurrence — with the method shown for each result, so you
          can reproduce it yourself.
        </p>
        <SearchBar />
      </section>

      {surah && sample ? (
        <section aria-labelledby="try-it">
          <h2
            id="try-it"
            className="mb-3 text-[12px] font-medium uppercase tracking-wider text-ink3"
          >
            Try it — every token has a permanent address
          </h2>
          <ReaderVerse
            surahNumber={2}
            surahName={surah.name_en}
            tokens={sample.tokens}
            from={43}
            mode="reading"
          />
        </section>
      ) : null}

      <section aria-label="What the workbench holds">
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <li className="rounded-xl border border-line bg-panel p-6">
            <div className="text-[26px] font-semibold text-accent">{words}</div>
            <h3 className="mt-1 text-[15px] font-semibold text-ink">Word pages</h3>
            <p className="mt-1 text-[14px] text-ink2">
              One permanent page per token — occurrences, neighbours, morphology.
            </p>
          </li>
          <li className="rounded-xl border border-line bg-panel p-6">
            <div className="text-[26px] font-semibold text-accent">{roots}</div>
            <h3 className="mt-1 text-[15px] font-semibold text-ink">Root pages</h3>
            <p className="mt-1 text-[14px] text-ink2">
              Every derived form and its distribution across the whole text.
            </p>
          </li>
          <li className="rounded-xl border border-line bg-panel p-6">
            <div className="text-[26px] font-semibold text-accent">Open</div>
            <h3 className="mt-1 text-[15px] font-semibold text-ink">Data and method</h3>
            <p className="mt-1 text-[14px] text-ink2">
              Versioned, checksummed, reproducible. Built to be built on.
            </p>
          </li>
        </ul>
      </section>

      <section aria-labelledby="surahs">
        <h2 id="surahs" className="mb-4 text-[20px] font-semibold text-ink">
          Read a surah
        </h2>
        <SurahIndex />
      </section>
    </div>
  );
}
