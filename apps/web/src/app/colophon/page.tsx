import type { Metadata } from 'next';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ProvenanceTag } from '@/components/ProvenanceTag';
import { SITE_NAME } from '@/lib/site';
import { artifactsRoot, currentVersion } from '@/server/artifacts';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'Colophon',
  description:
    'Every source, licence, tool and credit behind quranbench in one place: the Tanzil text, the Leeds Quranic Arabic Corpus, the translation editions, Lane’s Lexicon, and the Amiri typeface — each with its licence and checksum.',
  alternates: { canonical: '/colophon' },
};

// Every source in the corpus manifest, with the extra fields the translation and
// licensed editions carry. The base fields (name, licence, url, sha256) come from
// the same sources.json the /method page reads; the colophon lists them in full so
// nothing the project stands on is unattributed.
interface SourceRecord {
  id: string;
  name: string;
  publisher: string;
  edition: string;
  year: number | null;
  url: string;
  licence: string;
  licence_url?: string;
  licence_note?: string;
  role: string;
  translator?: string;
  sha256: string;
}

function sources(version: string): SourceRecord[] {
  const path = join(artifactsRoot(), `v${version}`, 'sources.json');
  return JSON.parse(readFileSync(path, 'utf8')) as SourceRecord[];
}

const ROLE_GROUPS: { role: string | ((r: string) => boolean); title: string }[] = [
  { role: (r) => r === 'text-edition' || r === 'metadata', title: 'The text' },
  {
    role: (r) =>
      r === 'morphology' || r === 'word-gloss' || r === 'word-transliteration',
    title: 'Morphology, gloss and transliteration',
  },
  { role: 'translation', title: 'Translation editions' },
  { role: 'lexicon', title: 'Lexicon' },
];

function matches(group: (typeof ROLE_GROUPS)[number], role: string): boolean {
  return typeof group.role === 'function' ? group.role(role) : group.role === role;
}

function SourceCard({ source }: { source: SourceRecord }) {
  return (
    <li className="rounded-xl border border-line bg-panel px-5 py-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[15px] font-semibold text-ink">{source.name}</h3>
        <span className="font-ui text-[12px] text-ink3">{source.licence}</span>
      </div>
      <dl className="flex flex-col gap-1 text-[13px] text-ink2">
        <div className="flex gap-2">
          <dt className="text-ink3">Publisher</dt>
          <dd>{source.publisher}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-ink3">Edition</dt>
          <dd>
            {source.edition}
            {source.translator ? ` · ${source.translator}` : ''}
            {source.year ? ` · ${source.year}` : ''}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-ink3">Source</dt>
          <dd className="min-w-0">
            <a
              href={source.url}
              className="break-all text-accent hover:underline"
              rel="nofollow"
            >
              {source.url}
            </a>
          </dd>
        </div>
        {source.licence_url ? (
          <div className="flex gap-2">
            <dt className="text-ink3">Licence</dt>
            <dd className="min-w-0">
              <a
                href={source.licence_url}
                className="break-all text-accent hover:underline"
                rel="nofollow"
              >
                {source.licence_url}
              </a>
            </dd>
          </div>
        ) : null}
      </dl>
      {source.licence_note ? (
        <p className="mt-2 text-[12px] leading-relaxed text-ink3">
          {source.licence_note}
        </p>
      ) : null}
      <p className="mt-2 break-all font-ui text-[11px] text-ink3">
        sha256 {source.sha256}
      </p>
    </li>
  );
}

export default function ColophonPage() {
  const version = currentVersion();
  const all = sources(version);
  const grouped = ROLE_GROUPS.map((group) => ({
    title: group.title,
    items: all.filter((s) => matches(group, s.role)),
  }));
  const listed = new Set(grouped.flatMap((g) => g.items.map((s) => s.id)));
  const other = all.filter((s) => !listed.has(s.id));

  return (
    <article className="mx-auto max-w-reader">
      <header className="mb-8">
        <div className="mb-3">
          <ProvenanceTag layer="editorial" note={`sources of v${version}`} />
        </div>
        <h1 className="text-[26px] font-semibold tracking-tight text-ink">
          Colophon
        </h1>
        <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink2">
          {SITE_NAME} stands on other people&rsquo;s work. Here is all of it — every
          text, dataset, lexicon, translation and typeface — with its licence and
          the exact checksum of what we ingested. The definitive machine-readable
          record is the{' '}
          <a href="/api/v1/manifest" className="text-accent underline">
            corpus manifest
          </a>
          ; this page is the human one.
        </p>
      </header>

      {grouped.map((group) =>
        group.items.length > 0 ? (
          <section key={group.title} className="mb-9">
            <h2 className="mb-3 text-[18px] font-semibold text-ink">
              {group.title}
            </h2>
            <ul className="flex flex-col gap-3">
              {group.items.map((s) => (
                <SourceCard key={s.id} source={s} />
              ))}
            </ul>
          </section>
        ) : null,
      )}

      {other.length > 0 ? (
        <section className="mb-9">
          <h2 className="mb-3 text-[18px] font-semibold text-ink">
            Other sources
          </h2>
          <ul className="flex flex-col gap-3">
            {other.map((s) => (
              <SourceCard key={s.id} source={s} />
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mb-9">
        <h2 className="mb-3 text-[18px] font-semibold text-ink">Typography</h2>
        <ul className="flex flex-col gap-3">
          <li className="rounded-xl border border-line bg-panel px-5 py-4">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-[15px] font-semibold text-ink">
                Amiri &amp; Amiri Quran
              </h3>
              <span className="font-ui text-[12px] text-ink3">OFL-1.1</span>
            </div>
            <p className="text-[13px] leading-relaxed text-ink2">
              The Arabic is set in Amiri, a classical Naskh typeface by the Amiri
              Project Authors (Khaled Hosny and contributors). Copyright 2010–2022
              The Amiri Project Authors, licensed under the SIL Open Font License
              1.1. The licence text ships with the site at{' '}
              <a href="/fonts/OFL.txt" className="text-accent underline">
                /fonts/OFL.txt
              </a>
              .
            </p>
          </li>
        </ul>
      </section>

      <section className="mb-9">
        <h2 className="mb-3 text-[18px] font-semibold text-ink">Thanks</h2>
        <p className="text-[15px] leading-relaxed text-ink2">
          With gratitude to the <strong>Tanzil Project</strong> for the Quran text;
          to <strong>Kais Dukes</strong> and the{' '}
          <strong>University of Leeds</strong> for the Quranic Arabic Corpus
          morphology, word gloss and transliteration; to the translators —{' '}
          <strong>Marmaduke Pickthall</strong>,{' '}
          <strong>John Medows Rodwell</strong>,{' '}
          <strong>Edward Henry Palmer</strong> and <strong>Talal Itani</strong>;
          to <strong>Edward William Lane</strong> and the{' '}
          <strong>Perseus Digital Library (Tufts University)</strong> for the
          Arabic-English Lexicon; and to the <strong>Amiri Project Authors</strong>{' '}
          for the typeface. Their licences are honoured above and their copyleft
          obligations propagate through our data.
        </p>
      </section>

      <footer className="mt-6 border-t border-line pt-5 text-[13px] leading-relaxed text-ink3">
        <p>
          To download the corpus and verify these checksums yourself, see{' '}
          <a href="/data" className="text-accent underline">
            the dataset page
          </a>
          . To understand what is computed versus asserted, see{' '}
          <a href="/method" className="text-accent underline">
            how this is built
          </a>
          .
        </p>
      </footer>
    </article>
  );
}
