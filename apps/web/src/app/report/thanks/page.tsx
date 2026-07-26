import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Correction received',
  description: 'What happens after you report a correction.',
  robots: { index: false, follow: true },
  alternates: { canonical: '/report/thanks' },
};

export default function ReportThanksPage() {
  return (
    <article className="mx-auto max-w-reader">
      <header className="mb-6">
        <h1 className="text-[26px] font-semibold tracking-tight text-ink">
          Correction received
        </h1>
        <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink2">
          Thank you. Your report is in the moderation queue. Here is what happens
          next, honestly.
        </p>
      </header>

      <ul className="flex flex-col gap-4 text-[15px] leading-relaxed text-ink2">
        <li className="rounded-xl border border-line bg-panel px-5 py-4">
          <strong className="text-ink">It is reviewed by a person.</strong> There
          is no automatic edit. A maintainer reads the report and checks it against
          the source it concerns — the morphology alignment, the translation
          edition, or the editorial text.
        </li>
        <li className="rounded-xl border border-line bg-panel px-5 py-4">
          <strong className="text-ink">
            Quranic text is never what changes.
          </strong>{' '}
          The Arabic source is immutable and attributed to Tanzil. A correction can
          only ever affect an annotation, a transliteration or gloss, a translation,
          or our own editorial content — never the scripture itself.
        </li>
        <li className="rounded-xl border border-line bg-panel px-5 py-4">
          <strong className="text-ink">
            A corpus fix ships as a new version.
          </strong>{' '}
          Corpus artifacts are immutable once released. If a report leads to a data
          change, it appears in the next versioned corpus, not by silently editing
          the current one — so every published citation stays reproducible.
        </li>
        <li className="rounded-xl border border-line bg-panel px-5 py-4">
          <strong className="text-ink">You may not hear back.</strong> If you left
          contact details we may reach out with a question, but most reports are
          simply acted on or, with reasons, not. We would rather be honest about
          that than promise a reply we cannot guarantee.
        </li>
      </ul>

      <div className="mt-8 flex flex-wrap gap-4 text-[14px]">
        <a href="/" className="text-accent hover:underline">
          ← Back to reading
        </a>
        <a href="/report" className="text-accent hover:underline">
          Report another correction
        </a>
        <a href="/method" className="text-accent hover:underline">
          How the corpus is built
        </a>
      </div>
    </article>
  );
}
