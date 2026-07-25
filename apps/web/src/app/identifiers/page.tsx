import type { Metadata } from 'next';

import { ProvenanceTag } from '@/components/ProvenanceTag';
import { downloadHref } from '@/server/api/downloads';
import {
  currentVersion,
  listArtifacts,
  readManifest,
} from '@/server/artifacts';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'Identifier policy',
  description:
    'How quranbench identifiers and URLs stay stable: opaque permanent ids, the segmentation scheme carried in every id, immutable semver versions, per-version mapping tables, and 301/410 instead of 404.',
  alternates: { canonical: '/identifiers' },
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-[18px] font-semibold text-ink">{title}</h2>
      <div className="flex flex-col gap-3 text-[15px] leading-relaxed text-ink2">
        {children}
      </div>
    </section>
  );
}

export default function IdentifiersPage() {
  const version = currentVersion();
  const manifest = readManifest(version);
  const mappingFiles = listArtifacts(version).filter(
    (a) => a.path.startsWith('mapping/') && a.path.endsWith('.json'),
  );

  return (
    <article className="mx-auto max-w-reader">
      <header className="mb-8">
        <div className="mb-3">
          <ProvenanceTag layer="editorial" note="policy" />
        </div>
        <h1 className="text-[26px] font-semibold tracking-tight text-ink">
          Identifier policy
        </h1>
        <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink2">
          Other people&rsquo;s citations depend on our URLs never breaking.
          Saying that publicly is what turns it into a commitment. This is the
          commitment.
        </p>
      </header>

      <Section title="Identifiers are opaque and permanent">
        <p>
          Every token, verse and root has an identifier that is stable across
          time. Position in a verse is an <em>attribute</em> of a token, never
          its identity — renumbering a scheme never changes an id.
        </p>
        <p>
          Each identifier carries the segmentation scheme it belongs to. The
          current format is:
        </p>
        <code className="rounded-lg border border-line bg-panel px-3 py-2 font-ui text-[13px] text-ink">
          {manifest.identifier_format}
        </code>
        <p>
          Segmentation scheme <strong>{manifest.segmentation_scheme}</strong>,
          work <strong>{manifest.work_id}</strong>. An id from one scheme is
          never silently reinterpreted under another.
        </p>
      </Section>

      <Section title="Versions are immutable semver">
        <p>
          A corpus version is published once and never edited. Corrections ship
          a <em>new</em> version; the old one keeps resolving exactly as it did.
          A citation therefore names a version, not &ldquo;the current
          site.&rdquo; The current version is <strong>{version}</strong>
          {manifest.previous_version
            ? `, succeeding ${manifest.previous_version}`
            : ''}
          .
        </p>
        <p>
          Every artifact of a version has a published sha256, so a third party
          can verify a copy byte-for-byte. See{' '}
          <a href="/data" className="text-accent underline">
            the downloads page
          </a>
          .
        </p>
      </Section>

      <Section title="Every release publishes a mapping table">
        <p>
          When a token splits, merges or moves between versions, the change is
          recorded explicitly: a successor id or an explicit tombstone. No id
          silently disappears.
        </p>
        {mappingFiles.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {mappingFiles.map((file) => (
              <li key={file.path}>
                <a
                  href={downloadHref(version, file.path)}
                  className="font-ui text-[13px] text-accent underline"
                  download
                >
                  {file.path}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink3">
            No mapping table for this version yet (it is the earliest published
            release).
          </p>
        )}
      </Section>

      <Section title="URLs never 404">
        <p>
          A retired URL <strong>301</strong>s to its successor, or returns{' '}
          <strong>410 Gone</strong> with an explanation. It is never silently
          reused for something else, and never a bare 404. A URL published today
          resolves in ten years, or resolves to an explicit successor.
        </p>
      </Section>

      <Section title="Machine-readable">
        <p>
          The API exposes the same guarantees. The{' '}
          <a
            href="/.well-known/quranbench.json"
            className="text-accent underline"
          >
            well-known descriptor
          </a>{' '}
          points at the API, the dataset index and this policy; the{' '}
          <a href="/api/v1/manifest" className="text-accent underline">
            manifest endpoint
          </a>{' '}
          carries the identifier format and version lineage for any release.
        </p>
      </Section>
    </article>
  );
}
