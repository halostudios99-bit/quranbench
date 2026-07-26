import type { Metadata } from 'next';

import {
  alertClass,
  alertStyle,
  fieldClass,
  formButtonClass,
  labelClass as baseLabelClass,
} from '@/app/(auth)/form-styles';

export const metadata: Metadata = {
  title: 'Report a correction',
  description:
    'Tell us what is wrong on a page — an annotation, a translation, or editorial content. Corrections to Quranic text itself are impossible by design; the source text is immutable and attributed to Tanzil.',
  alternates: { canonical: '/report' },
};

const ERRORS: Record<string, string> = {
  path: 'The page being corrected is missing. Enter the path of the page.',
  problem: 'Describe what is wrong so it can be checked.',
  rate_limited: 'Too many reports from here just now. Please try again later.',
};

interface SearchParams {
  searchParams: Promise<{
    path?: string;
    ref?: string;
    error?: string;
    problem?: string;
    correction?: string;
    contact?: string;
  }>;
}

const inputClass = `${fieldClass} w-full placeholder:text-ink3`;
const labelClass = `${baseLabelClass} mb-1.5 block`;
const hintClass = 'mb-1.5 text-[13px] text-ink3';

export default async function ReportPage({ searchParams }: SearchParams) {
  const sp = await searchParams;
  const error = sp.error ? ERRORS[sp.error] : undefined;
  const path = sp.path ?? '';
  const ref = sp.ref ?? '';

  return (
    <article className="mx-auto max-w-reader">
      <header className="mb-6">
        <h1 className="text-[26px] font-semibold tracking-tight text-ink">
          Report a correction
        </h1>
        <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink2">
          A platform that promises to be corrected must have somewhere to be told.
          If something on a page is wrong — a morphology annotation, a
          transliteration or gloss, a translation, or an editorial note — describe
          it here and it goes into the moderation queue for review.
        </p>
      </header>

      <div className="mb-6 rounded-xl border border-line bg-panel px-5 py-4 text-[14px] leading-relaxed text-ink2">
        <p>
          <strong>The Quranic text itself cannot be corrected here</strong> — by
          design. The Arabic source text is immutable and attributed to Tanzil; we
          never modify it. A correction therefore only ever concerns the layers
          around it: the <em>morphology</em> (Leeds QAC), a <em>transliteration or
          gloss</em>, a <em>translation edition</em>, or our own{' '}
          <em>editorial</em> content.
        </p>
      </div>

      {error ? (
        <p role="alert" className={`mb-5 ${alertClass}`} style={alertStyle}>
          {error}
        </p>
      ) : null}

      <form
        action="/report/submit"
        method="post"
        className="flex flex-col gap-5"
      >
        <div>
          <label htmlFor="path" className={labelClass}>
            Which page?
          </label>
          {ref ? (
            <p className={hintClass}>
              Reporting <strong>{ref}</strong>. You can edit the path if needed.
            </p>
          ) : (
            <p className={hintClass}>
              The path of the page with the problem, e.g. <code>/2/43</code> or{' '}
              <code>/root/z-k-w</code>.
            </p>
          )}
          <input
            id="path"
            name="path"
            type="text"
            required
            defaultValue={path}
            placeholder="/2/43"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="problem" className={labelClass}>
            What is wrong?
          </label>
          <textarea
            id="problem"
            name="problem"
            required
            rows={4}
            defaultValue={sp.problem ?? ''}
            placeholder="Describe the error — which annotation, translation or note, and why it is wrong."
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="correction" className={labelClass}>
            What should it be? <span className="text-ink3">(optional)</span>
          </label>
          <textarea
            id="correction"
            name="correction"
            rows={3}
            defaultValue={sp.correction ?? ''}
            placeholder="The correct value, and a source if you have one."
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="contact" className={labelClass}>
            Contact <span className="text-ink3">(optional)</span>
          </label>
          <p className={hintClass}>
            An email or handle if you are willing to be reached about this. Leave it
            blank to report anonymously.
          </p>
          <input
            id="contact"
            name="contact"
            type="text"
            defaultValue={sp.contact ?? ''}
            autoComplete="off"
            className={inputClass}
          />
        </div>

        <div>
          <button type="submit" className={formButtonClass}>
            Submit correction
          </button>
        </div>
      </form>

      <p className="mt-6 text-[13px] leading-relaxed text-ink3">
        No account is required. Reports are rate limited to prevent abuse. What
        happens next is described on the confirmation page.
      </p>
    </article>
  );
}
