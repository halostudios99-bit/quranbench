import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ProvenanceTag } from '@/components/ProvenanceTag';
import {
  investigationHref,
  STATUS_LABEL,
} from '@/lib/investigation-format';
import { getInvestigationView } from '@/server/research';
import { getCurrentUser } from '@/server/auth';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const viewer = await getCurrentUser();
  const view = await getInvestigationView(slug, viewer?.id ?? null);
  if (!view) return { title: 'Investigation not found' };
  return {
    title: `Revision history — ${view.investigation.claim}`,
    description:
      'The public, append-only revision history of this investigation. Nothing is destructively edited.',
    alternates: { canonical: `${investigationHref(slug)}/revisions` },
  };
}

export default async function RevisionsPage({ params }: Params) {
  const { slug } = await params;
  const viewer = await getCurrentUser();
  const view = await getInvestigationView(slug, viewer?.id ?? null);
  if (!view) notFound();

  const { investigation: inv, revisions } = view;

  return (
    <div className="mx-auto max-w-reader">
      <nav aria-label="Breadcrumb" className="mb-3 text-[13px] text-ink3">
        <a href="/investigations" className="hover:text-ink2">
          Investigations
        </a>
        <span aria-hidden="true"> / </span>
        <a href={investigationHref(slug)} className="hover:text-ink2">
          {inv.claim.length > 48 ? `${inv.claim.slice(0, 48)}…` : inv.claim}
        </a>
        <span aria-hidden="true"> / </span>
        <span className="text-ink2">revisions</span>
      </nav>

      <header className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="text-[24px] font-semibold text-ink">Revision history</h1>
        <ProvenanceTag layer="community" />
      </header>
      <p className="mb-6 text-[14px] leading-relaxed text-ink2">
        Every edit appends a revision. Nothing here is overwritten or deleted —
        the full history is public.
      </p>

      <ol className="flex flex-col gap-3">
        {revisions.map((rev) => (
          <li
            key={rev.id}
            className="rounded-xl border border-line bg-panel px-5 py-4"
          >
            <div className="mb-2 flex flex-wrap items-center gap-2 font-ui text-[12px] text-ink3">
              <span className="rounded border border-line px-1.5 py-0.5 text-ink2">
                revision {rev.revision}
              </span>
              <span>{STATUS_LABEL[rev.status]}</span>
              {rev.note ? <span>· {rev.note}</span> : null}
              <span>· {rev.createdAt.toISOString().slice(0, 10)}</span>
            </div>
            <p className="text-[15px] font-medium text-ink">{rev.claim}</p>
            <p className="mt-1 font-ui text-[12px] text-ink3">
              query <code>{rev.query}</code>
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
