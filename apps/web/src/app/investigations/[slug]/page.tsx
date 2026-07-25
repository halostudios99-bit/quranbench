import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { JsonLd } from '@/components/JsonLd';
import { ProvenanceTag } from '@/components/ProvenanceTag';
import { absoluteUrl } from '@/lib/site';
import {
  investigationHref,
  investigationRevisionsHref,
  RESPONSE_TYPE_LABEL,
  STATUS_LABEL,
} from '@/lib/investigation-format';
import type { ResolvedPin } from '@/server/research';
import { getInvestigationView } from '@/server/research';
import type { ProvenanceLayer } from '@/lib/provenance';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const view = await getInvestigationView(slug);
  if (!view) return { title: 'Investigation not found' };
  return {
    title: view.investigation.claim,
    description: `Investigation: ${view.investigation.claim} Query, evidence and required counter-evidence, reproducible against corpus v${view.corpusVersion}.`,
    alternates: { canonical: investigationHref(slug) },
  };
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
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        <ProvenanceTag layer={provenance} note={note} />
      </div>
      {children}
    </section>
  );
}

function PinList({ pins }: { pins: ResolvedPin[] }) {
  if (pins.length === 0)
    return <p className="text-[14px] text-ink3">No evidence pinned.</p>;
  return (
    <ul className="flex flex-wrap gap-2">
      {pins.map((p) =>
        p.resolved ? (
          <li key={p.pin.id}>
            <a
              href={p.href!}
              className="inline-flex items-center gap-2 rounded-lg border border-line bg-bg px-3 py-1.5 hover:border-line2"
            >
              <span lang="ar" dir="rtl" className="quran text-[18px]">
                {p.text}
              </span>
              <span className="font-ui text-[12px] text-ink3">{p.ref}</span>
            </a>
          </li>
        ) : (
          <li
            key={p.pin.id}
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-bg px-3 py-1.5"
            title="This pin does not resolve against the current corpus version and is flagged for review."
          >
            <code className="font-ui text-[12px] text-ink3">{p.pin.tokenId}</code>
            <span className="rounded border border-line px-1.5 py-0.5 font-ui text-[11px] text-ink3">
              unresolved · v{p.pin.corpusVersion}
            </span>
          </li>
        ),
      )}
    </ul>
  );
}

export default async function InvestigationPage({ params }: Params) {
  const { slug } = await params;
  const view = await getInvestigationView(slug);
  if (!view) notFound();

  const { investigation: inv, authorHandle, queryResult, corpusVersion } = view;
  const canonical = absoluteUrl(investigationHref(slug));
  const searchHref = `/search?q=${encodeURIComponent(inv.query)}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Claim',
    text: inv.claim,
    url: canonical,
    author: { '@type': 'Person', name: `@${authorHandle}` },
    ...(inv.publishedAt ? { datePublished: inv.publishedAt.toISOString() } : {}),
  };

  return (
    <article className="mx-auto flex max-w-reader flex-col gap-4">
      <JsonLd data={jsonLd} />

      <header className="rounded-xl border border-line bg-panel px-5 py-6 sm:px-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <ProvenanceTag layer="community" note={STATUS_LABEL[inv.status]} />
          <span className="font-ui text-[13px] text-ink3">
            by <span className="text-ink2">@{authorHandle}</span>
          </span>
        </div>
        <h1 className="text-[24px] font-semibold leading-snug text-ink">
          {inv.claim}
        </h1>
        {inv.flaggedForReview ? (
          <p className="mt-4 rounded-lg border border-line bg-bg px-4 py-3 text-[13px] text-ink2">
            <strong className="text-ink">Flagged for review.</strong>{' '}
            {inv.reviewReason ??
              'Some evidence could not be resolved against the current corpus version.'}{' '}
            The pins are kept, not dropped.
          </p>
        ) : null}
      </header>

      <Section title="Query" provenance="computed" note={`corpus v${corpusVersion}`}>
        <p className="mb-3 text-[14px] text-ink2">
          Run it yourself — this is the reproducible basis of the claim.
        </p>
        <a
          href={searchHref}
          className="inline-block rounded-lg border border-line bg-bg px-3 py-2 font-ui text-[13px] text-accent hover:border-line2"
        >
          <code>{inv.query}</code>
        </a>
        <p className="mt-3 text-[13px] text-ink3">
          {queryResult.ok
            ? `${queryResult.count} match${queryResult.count === 1 ? '' : 'es'} against corpus v${corpusVersion}.`
            : `Query error: ${queryResult.error ?? 'unknown'}.`}
        </p>
      </Section>

      <Section title="Evidence" provenance="quran">
        <PinList pins={view.pins} />
      </Section>

      <Section title="Counter-evidence" provenance="editorial">
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink2">
          {inv.counterEvidence}
        </p>
      </Section>

      <Section
        title={`Responses · ${view.responses.length}`}
        provenance="community"
      >
        {view.responses.length === 0 ? (
          <p className="text-[14px] text-ink3">
            No responses yet. A response must declare a type and cite evidence.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {view.responses.map(({ response, pins }) => (
              <li
                key={response.id}
                className="rounded-lg border border-line bg-bg px-4 py-3"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="rounded-full border border-line px-2 py-0.5 font-ui text-[11px] text-ink2">
                    {RESPONSE_TYPE_LABEL[response.type]}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-ink2">
                  {response.body}
                </p>
                <div className="mt-2">
                  <PinList pins={pins} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <footer className="border-t border-line pt-4 text-[12px] leading-relaxed text-ink3">
        <p>
          Status {STATUS_LABEL[inv.status]} · corpus v{corpusVersion} ·{' '}
          <a href={investigationRevisionsHref(slug)} className="text-accent hover:underline">
            revision history
          </a>
          . Every published investigation carries a claim, a runnable query,
          pinned evidence and its own counter-evidence. Reproduce any figure by
          running the query against the named corpus version.
        </p>
      </footer>
    </article>
  );
}
