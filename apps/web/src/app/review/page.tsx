import type { Metadata } from 'next';

import { getJudgementQueue } from '@/server/corpus';
import { ProvenanceTag } from '@/components/ProvenanceTag';

export const metadata: Metadata = {
  title: 'Review queue — QuranBench',
  description:
    'Every word in the generated translation that rests on judgement rather than corpus evidence, listed for review.',
};

// The generated edition reached 100% of verses with 1,563 of its 5,400
// decisions graded `judgement` — words occurring once in the Quran, rendered
// from general Arabic because the corpus cannot settle them. Until this page
// existed, the only way to find one was to stumble on its underline while
// reading. A review that is impossible does not happen; this page is what
// makes it possible: every judgement word, its verse, its rendering and the
// evidence recorded when it was decided, in reading order, with a correction
// link on each row.

export const revalidate = 3600;

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

const PER_PAGE = 50;

export default async function ReviewPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const queue = getJudgementQueue();
  const pages = Math.max(1, Math.ceil(queue.length / PER_PAGE));
  const page = Math.min(pages, Math.max(1, Number(params.page) || 1));
  const slice = queue.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[28px] font-semibold text-ink">Review queue</h1>
        <ProvenanceTag
          layer="translation"
          note="generated edition — judgement grade"
          title="Words rendered from general Arabic under Rule 22, not settled by the corpus."
        />
      </div>
      <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink2">
        {queue.length.toLocaleString()} words in the generated translation are
        graded <em>judgement</em>: they occur once in the Quran, so the text
        itself cannot settle their sense, and the rendering rests on general
        Arabic. Each is underlined in the reader. This page lists all of them
        so they can be reviewed deliberately rather than found by accident.
        Disagree with one? Every row links to a correction form.
      </p>

      <ol className="mt-6 flex flex-col divide-y divide-line">
        {slice.map((item) => (
          <li key={`${item.ref}-${item.arabic}`} className="py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="quran text-[20px] text-ink" lang="ar" dir="rtl">
                {item.arabic}
              </span>
              <a
                href={item.href}
                className="inline-block py-1 font-ui text-[14px] text-accent hover:underline"
              >
                {item.ref}
              </a>
            </div>
            <p className="mt-1 text-[15px] text-ink">
              rendered{' '}
              <mark className="bg-transparent underline decoration-dotted underline-offset-4">
                {item.english}
              </mark>
            </p>
            {item.evidence ? (
              <p className="mt-1 text-[13px] leading-relaxed text-ink3">
                {item.evidence}
              </p>
            ) : null}
            <a
              href={`/report?path=${encodeURIComponent(item.href)}&ref=${encodeURIComponent(
                `judgement word "${item.english}" at ${item.ref}`,
              )}`}
              className="mt-1 inline-block py-1 text-[13px] text-ink3 underline decoration-line underline-offset-2 hover:text-ink2"
            >
              Suggest a correction
            </a>
          </li>
        ))}
      </ol>

      <nav
        aria-label="Review pages"
        className="mt-8 flex items-center justify-between text-[14px]"
      >
        {page > 1 ? (
          <a
            href={`/review?page=${page - 1}`}
            className="inline-block py-1 text-accent hover:underline"
          >
            ← Previous
          </a>
        ) : (
          <span />
        )}
        <span className="text-ink3">
          Page {page} of {pages}
        </span>
        {page < pages ? (
          <a
            href={`/review?page=${page + 1}`}
            className="inline-block py-1 text-accent hover:underline"
          >
            Next →
          </a>
        ) : (
          <span />
        )}
      </nav>
    </main>
  );
}
