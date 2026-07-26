import type { Metadata } from 'next';

import { CitationCopy } from '@/components/CitationCopy';
import { JsonLd } from '@/components/JsonLd';
import { ProvenanceTag } from '@/components/ProvenanceTag';
import { buildCitation } from '@/lib/citation';
import { absoluteUrl } from '@/lib/site';
import {
  currentVersion,
  displayOnlyEditions,
  listVersions,
  manifestSha256,
  readManifest,
} from '@/server/artifacts';
import {
  downloadHref,
  formatBytes,
  fullDownload,
  licenceGroups,
} from '@/server/api/downloads';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'Data downloads',
  description:
    'Download the full quranbench Quran corpus per version, with sha256 and byte size for every artifact, separated by licence. Cite a specific, immutable version and verify it byte-for-byte.',
  alternates: { canonical: '/data' },
};

// The retrieved date is fixed at build/revalidate time so the citation string is
// stable within a cache window rather than changing on every request.
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <code className="break-all font-ui text-[12px] text-ink3">{children}</code>
  );
}

export default function DataPage() {
  const versions = listVersions();
  const current = currentVersion();
  const retrieved = today();

  // Display-only editions are the same artifact across the versions that carry
  // them, so they are listed once for the whole dataset rather than repeated in
  // every version section. Deduplicate by edition id, keeping first (newest) seen.
  const displayOnly = Array.from(
    new Map(
      versions.flatMap(displayOnlyEditions).map((e) => [e.id, e]),
    ).values(),
  );

  const datasetLd = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'quranbench Quran corpus',
    description:
      'An open, versioned, reproducible Quran corpus: Uthmani text (Tanzil, CC-BY), morphology (Leeds QAC, GPL) and public-domain translation editions. Every token is permanently addressable.',
    url: absoluteUrl('/data'),
    version: current,
    isAccessibleForFree: true,
    creator: { '@type': 'Organization', name: 'quranbench' },
    license: 'https://quranbench.com/method',
    distribution: licenceGroups(current).flatMap((group) =>
      group.files.map((file) => ({
        '@type': 'DataDownload',
        name: file.path,
        contentUrl: absoluteUrl(downloadHref(current, file.path)),
        encodingFormat: file.path.endsWith('.jsonl')
          ? 'application/x-ndjson'
          : 'application/json',
        contentSize: `${file.bytes}`,
        license: group.licence_url,
        sha256: file.sha256,
      })),
    ),
  };

  return (
    <div className="mx-auto max-w-reader">
      <JsonLd data={datasetLd} />

      <header className="mb-8">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <ProvenanceTag layer="computed" note={`current v${current}`} />
        </div>
        <h1 className="text-[26px] font-semibold tracking-tight text-ink">
          Download the dataset
        </h1>
        <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink2">
          The whole corpus, per version, with a sha256 and byte size for every
          file. Versions are immutable: a citation names a version, and a
          corrected corpus ships as a new version — the old one keeps resolving.
          Take only the parts whose licence you can use.
        </p>
        <p className="mt-3 text-[13px] text-ink3">
          Read the{' '}
          <a href="/identifiers" className="text-accent underline">
            identifier policy
          </a>{' '}
          for how these URLs stay stable, and the{' '}
          <a href="/method" className="text-accent underline">
            method page
          </a>{' '}
          for exactly what is text, computed and asserted.
        </p>
      </header>

      {versions.map((version) => {
        const manifest = readManifest(version);
        const sha = manifestSha256(version);
        const groups = licenceGroups(version);
        const full = fullDownload(version);
        const citation = buildCitation({
          version,
          manifestSha256: sha,
          retrieved,
          url: absoluteUrl(`/data#${version}`),
        });
        const isCurrent = version === current;

        return (
          <section
            key={version}
            id={version}
            className="mb-10 scroll-mt-20 rounded-xl border border-line bg-panel px-5 py-6 sm:px-6"
          >
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-[19px] font-semibold text-ink">
                Version {version}
                {isCurrent ? (
                  <span className="ms-2 font-ui text-[12px] font-normal text-accent">
                    current
                  </span>
                ) : null}
              </h2>
              <span className="font-ui text-[12px] text-ink3">
                built {manifest.built_at?.slice(0, 10) ?? '—'} ·{' '}
                {manifest.counts.tokens.toLocaleString()} tokens ·{' '}
                {manifest.counts.verses.toLocaleString()} verses
              </span>
            </div>

            <div className="mb-5">
              <p className="mb-1 font-ui text-[11px] uppercase tracking-wide text-ink3">
                manifest.json sha256
              </p>
              <Mono>{sha}</Mono>
            </div>

            {full ? (
              <div className="mb-6">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <h3 className="text-[15px] font-semibold text-ink">
                    Full dataset (single archive)
                  </h3>
                  <span className="rounded border border-line px-1.5 py-0.5 font-ui text-[11px] text-ink2">
                    {full.licence}
                  </span>
                  <a
                    href={full.licence_url}
                    className="font-ui text-[11px] text-accent underline"
                  >
                    licence
                  </a>
                </div>
                <p className="mb-3 max-w-prose text-[13px] leading-relaxed text-ink3">
                  {full.note}
                </p>
                <ul className="flex flex-col rounded-lg border border-line">
                  <li className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                    <div className="min-w-0">
                      <a
                        href={full.href}
                        className="font-ui text-[13px] text-accent underline"
                        download
                      >
                        {full.filename}
                      </a>
                      <div className="mt-0.5">
                        <Mono>
                          {full.sha256.slice(0, 16)}… · {formatBytes(full.bytes)}
                        </Mono>
                      </div>
                    </div>
                  </li>
                </ul>
              </div>
            ) : null}

            {groups.map((group) => (
              <div key={group.id} className="mb-5">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <h3 className="text-[15px] font-semibold text-ink">
                    {group.title}
                  </h3>
                  <span className="rounded border border-line px-1.5 py-0.5 font-ui text-[11px] text-ink2">
                    {group.licence}
                  </span>
                  <a
                    href={group.licence_url}
                    className="font-ui text-[11px] text-accent underline"
                  >
                    licence
                  </a>
                </div>
                <p className="mb-3 max-w-prose text-[13px] leading-relaxed text-ink3">
                  {group.note}
                </p>
                <ul className="flex flex-col divide-y divide-line rounded-lg border border-line">
                  {group.files.map((file) => (
                    <li
                      key={file.path}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <a
                          href={downloadHref(version, file.path)}
                          className="font-ui text-[13px] text-accent underline"
                          download
                        >
                          {file.path}
                        </a>
                        <div className="mt-0.5">
                          <Mono>
                            {file.sha256.slice(0, 16)}… ·{' '}
                            {formatBytes(file.bytes)}
                          </Mono>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <div className="mt-6 border-t border-line pt-5">
              <h3 className="mb-2 text-[15px] font-semibold text-ink">
                How to cite this version
              </h3>
              <CitationCopy citation={citation} />
            </div>
          </section>
        );
      })}

      {displayOnly.length > 0 ? (
        <section className="mb-10 rounded-xl border border-line bg-panel px-5 py-6 sm:px-6">
          <h3 className="mb-2 text-[15px] font-semibold text-ink">
            Display-only translations (not downloadable)
          </h3>
          <p className="mb-4 max-w-prose text-[13px] leading-relaxed text-ink3">
            These editions are shown to readers on the site but are{' '}
            <strong>not</strong> part of the dataset: their licence permits
            display but forbids open redistribution, so they are excluded from
            every download above and from the full tarball. To use them, obtain
            the edition from its licensor under its own terms.
          </p>
          <ul className="flex flex-col divide-y divide-line rounded-lg border border-line">
            {displayOnly.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-[13px]"
              >
                <span className="text-ink2">
                  {e.translator} <span className="text-ink3">({e.year})</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="rounded border border-line px-1.5 py-0.5 font-ui text-[11px] text-ink2">
                    {e.licence}
                  </span>
                  <a
                    href={e.licence_url}
                    className="font-ui text-[11px] text-accent underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    licence
                  </a>
                  <span className="font-ui text-[11px] text-ink3">
                    display-only
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mb-10 rounded-xl border border-line bg-panel px-5 py-6 sm:px-6">
        <h2 className="mb-3 text-[18px] font-semibold text-ink">
          Verify it yourself
        </h2>
        <p className="mb-3 max-w-prose text-[14px] leading-relaxed text-ink2">
          Every artifact&rsquo;s sha256 is published here and inside the
          manifest. Download a file and confirm its checksum matches — no trust
          in this server required.
        </p>
        <pre
          tabIndex={0}
          aria-label="Verification commands"
          className="overflow-x-auto rounded-lg border border-line bg-bg px-4 py-3 font-ui text-[12px] leading-relaxed text-ink2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <code>{`# 1. Download an artifact and the manifest for a version
curl -sO https://quranbench.com/api/v1/download/${current}/verses.jsonl
curl -s "https://quranbench.com/api/v1/manifest?version=${current}" > manifest-api.json

# 2. Hash the file you received
shasum -a 256 verses.jsonl

# 3. Compare it to the published checksum
node -e "const m=require('./manifest-api.json').manifest; console.log(m.checksums['verses.jsonl'].sha256)"

# The two hashes must be identical. Repeat for any artifact.`}</code>
        </pre>
      </section>
    </div>
  );
}
