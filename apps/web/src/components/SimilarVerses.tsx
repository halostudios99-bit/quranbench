import { ProvenanceTag } from './ProvenanceTag';
import type { SimilarVersesResult } from '@/server/corpus';

// The verses most similar to this one, ranked by shared roots. The measure is
// stated inline and documented on /method: Jaccard over each verse's root set with
// a stoplist of ubiquitous roots removed. Computation, not argument — a score and
// the roots that produced it, nothing editorial.

function RootChip({ root, href }: { root: string; href: string }) {
  return (
    <a
      href={href}
      className="inline-flex items-center rounded-md border border-line bg-bg px-2 py-0.5 hover:border-line2"
    >
      <span lang="ar" dir="rtl" className="quran text-[17px] leading-none text-ink2">
        {root}
      </span>
    </a>
  );
}

export function SimilarVerses({ result }: { result: SimilarVersesResult }) {
  return (
    <section className="rounded-xl border border-line bg-panel px-5 py-5 sm:px-6">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 className="text-[15px] font-semibold text-ink">Similar verses</h2>
        <ProvenanceTag layer="computed" note="shared roots · Jaccard" />
      </div>
      <p className="mb-4 max-w-prose text-[13px] leading-relaxed text-ink2">
        Ranked by the{' '}
        <a href="/method#similar-verses" className="text-accent underline">
          Jaccard overlap
        </a>{' '}
        of the two verses&rsquo; root sets — shared roots over combined roots —
        after removing a stoplist of ubiquitous roots. The score is shown; the
        shared roots are listed so you can see exactly what drove it.
      </p>

      {result.targetRoots.length === 0 ? (
        <p className="text-[14px] text-ink3">
          This verse has no content roots outside the stoplist, so there is no
          discriminating signal to rank other verses against.
        </p>
      ) : result.items.length === 0 ? (
        <p className="text-[14px] text-ink3">
          No other verse shares a content root with this one.
        </p>
      ) : (
        <ol className="flex flex-col divide-y divide-line">
          {result.items.map((v) => (
            <li key={v.verseId} className="flex flex-col gap-2 py-3">
              <div className="flex items-center justify-between gap-3">
                <a
                  href={v.href}
                  className="font-ui text-[14px] text-accent hover:underline"
                >
                  {v.surahName} {v.ref}
                </a>
                <span
                  className="font-ui text-[13px] text-ink3"
                  title={`${v.intersection} shared of ${v.union} combined roots`}
                >
                  {v.score.toFixed(2)}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5" dir="rtl">
                {v.shared.map((r) => (
                  <RootChip key={r.slug} root={r.root} href={r.href} />
                ))}
              </div>
            </li>
          ))}
        </ol>
      )}

      {result.excluded.length > 0 ? (
        <p className="mt-4 border-t border-line pt-3 font-ui text-[12px] leading-relaxed text-ink3">
          Excluded from the measure as ubiquitous:{' '}
          {result.excluded.map((r, i) => (
            <span key={r.slug}>
              {i > 0 ? ', ' : ''}
              <span lang="ar" dir="rtl" className="quran text-[15px]">
                {r.root}
              </span>
            </span>
          ))}
          . See{' '}
          <a href="/method#similar-verses" className="text-accent underline">
            the method
          </a>
          .
        </p>
      ) : null}
    </section>
  );
}
