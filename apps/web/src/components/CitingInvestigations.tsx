import { ProvenanceTag } from '@/components/ProvenanceTag';
import { investigationHref, STATUS_LABEL } from '@/lib/investigation-format';
import type { CitingInvestigation } from '@/server/domain/types';

// The discovery mechanism: a word or root page lists the published investigations
// that cite it as evidence. This is how a researcher reaching a word finds the
// argument built on it. The data comes from the citation projection (one indexed
// lookup), never a scan over investigations.
interface Props {
  items: CitingInvestigation[];
  /** What the visitor is looking at, for the empty-state copy. */
  subject: string;
}

export function CitingInvestigations({ items, subject }: Props) {
  return (
    <section className="rounded-xl border border-line bg-panel px-5 py-5 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="text-[15px] font-semibold text-ink">
          Cited by {items.length} investigation{items.length === 1 ? '' : 's'}
        </h2>
        <ProvenanceTag layer="community" />
      </div>
      {items.length === 0 ? (
        <p className="text-[14px] text-ink3">
          No published investigation cites {subject} yet. When one does, it
          appears here — the evidence links back to the argument.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((inv) => (
            <li
              key={inv.id}
              className="rounded-lg border border-line bg-bg px-4 py-3"
            >
              <a
                href={investigationHref(inv.slug)}
                className="text-[15px] font-medium text-ink hover:text-accent"
              >
                {inv.claim}
              </a>
              <p className="mt-1 font-ui text-[12px] text-ink3">
                {STATUS_LABEL[inv.status]} · by{' '}
                <span className="text-ink2">@{inv.authorHandle}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
