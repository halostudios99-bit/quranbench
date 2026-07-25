import type { Metadata } from 'next';

import { ProvenanceTag } from '@/components/ProvenanceTag';
import { investigationHref, STATUS_LABEL } from '@/lib/investigation-format';
import { listPublishedInvestigations } from '@/server/research';

// Investigations are backed by the application database, which changes as people
// publish. This page is server-rendered on request, never statically cached at
// build time (which would also require a database at build).
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Investigations',
  description:
    'Open, falsifiable investigations of the Quran. Each states a claim, attaches a reproducible query and evidence, and requires its own counter-evidence. Do not accept the interpretation — open the evidence and reproduce it.',
  alternates: { canonical: '/investigations' },
};

export default async function InvestigationsPage() {
  const investigations = await listPublishedInvestigations();

  return (
    <div className="mx-auto max-w-reader">
      <header className="mb-6">
        <h1 className="text-[28px] font-semibold text-ink">Investigations</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink2">
          Each investigation states one falsifiable claim, attaches a query you
          can run yourself, pins its evidence to specific words, and must state
          the counter-evidence against it. Do not accept the interpretation —
          open the evidence and reproduce the search.
        </p>
      </header>

      {investigations.length === 0 ? (
        <p className="rounded-xl border border-line bg-panel px-5 py-8 text-center text-[15px] text-ink3">
          No investigations have been published yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {investigations.map((inv) => (
            <li key={inv.id}>
              <a
                href={investigationHref(inv.slug)}
                className="block rounded-xl border border-line bg-panel px-5 py-4 hover:border-line2"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <ProvenanceTag layer="community" note={STATUS_LABEL[inv.status]} />
                  {inv.flaggedForReview ? (
                    <span className="rounded-full border border-line px-2 py-0.5 font-ui text-[11px] text-ink3">
                      flagged for review
                    </span>
                  ) : null}
                </div>
                <p className="text-[16px] font-medium leading-snug text-ink">
                  {inv.claim}
                </p>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
