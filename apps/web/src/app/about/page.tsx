import type { Metadata } from 'next';

import { ProvenanceTag } from '@/components/ProvenanceTag';
import {
  SITE_NAME,
  SITE_OWNER_NAME,
  SITE_OWNER_NAME_PENDING,
} from '@/lib/site';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'About',
  description:
    'What quranbench is, why it exists, what it claims and does not claim, who runs it, how it is funded, and its editorial policy. Written for a sceptical first-time visitor.',
  alternates: { canonical: '/about' },
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-9">
      <h2 className="mb-3 text-[18px] font-semibold text-ink">{title}</h2>
      <div className="flex flex-col gap-3 text-[15px] leading-relaxed text-ink2">
        {children}
      </div>
    </section>
  );
}

export default function AboutPage() {
  return (
    <article className="mx-auto max-w-reader">
      <header className="mb-8">
        <div className="mb-3">
          <ProvenanceTag layer="editorial" />
        </div>
        <h1 className="text-[26px] font-semibold tracking-tight text-ink">
          About {SITE_NAME}
        </h1>
        <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink2">
          You should not have to take anyone&rsquo;s word for what the Quran says —
          including ours. {SITE_NAME} exists so you don&rsquo;t have to. This page is
          for the sceptic: what this is, what it refuses to do, who is behind it, and
          how it stays honest.
        </p>
      </header>

      <Section title="What this is">
        <p>
          {SITE_NAME} is an open research workbench for the Quran. Every Arabic word
          is a permanent, addressable object with its own page: its forms, its
          position, its root and morphology, every other place the same form occurs,
          and how translators rendered the verse around it. Search runs over the text
          by its own words — form, root, lemma, proximity — and every result shows
          the query and the corpus version that produced it, so you can reproduce it.
        </p>
        <p>
          The promise is simple:{' '}
          <strong>
            do not accept our interpretation. Open the evidence, reproduce the
            search, and investigate the Quran yourself.
          </strong>
        </p>
      </Section>

      <Section title="Why it exists">
        <p>
          Most Quran sites ask you to trust a rendering. The interesting questions —
          where a root recurs, when different Arabic words are translated the same
          way, how editions disagree — are exactly the ones a page of prose hides.
          {' '}
          {SITE_NAME} treats those as computations you can run and check, not
          conclusions you must accept. It is built to be <em>cited</em>: stable URLs,
          versioned data, and a machine-readable API alongside every human page.
        </p>
      </Section>

      <Section title="What it claims — and does not claim">
        <p>
          <strong>It claims</strong> that every computed figure — a count, a
          frequency, a co-occurrence, a similarity score — is derived
          deterministically from a named corpus version and reproduces exactly.
          Where a fact comes from an outside source, it is labelled with that source.
        </p>
        <p>
          <strong>It does not claim</strong> to settle meaning. The morphology is a
          third-party scholarly reconstruction (Leeds QAC) with its own editorial
          choices; the translations are human editions we attribute and never blend;
          our own investigations are labelled editorial and are the only layer that
          is our opinion. Disagreeing with any of these is legitimate, and every
          layer is tagged so you always know which one you are reading.
        </p>
        <p>
          Above all, <strong>the Quranic text is never modified.</strong> Normalised,
          tashkeel-stripped and segmented forms are stored as separate, labelled
          fields; the source text is immutable and always attributed to Tanzil.
          Nothing we create is allowed to visually resemble scripture. See{' '}
          <a href="/method" className="text-accent underline">
            how this is built
          </a>{' '}
          for the exact provenance of every field.
        </p>
      </Section>

      <Section title="Who runs it">
        {SITE_OWNER_NAME_PENDING ? (
          <p data-owner-placeholder="true">
            The maintainer has not yet decided whether to publish a legal name, so
            the identity here is deliberately left as a clearly-marked placeholder:{' '}
            <strong>{SITE_OWNER_NAME}</strong>. We would rather show a visible
            placeholder than invent a name or quietly omit the question — a project
            that asks for your scepticism should be scrutable about its own
            authorship. This line will be filled in, in one place, when that decision
            is made.
          </p>
        ) : (
          <p>
            {SITE_NAME} is maintained by <strong>{SITE_OWNER_NAME}</strong>.
          </p>
        )}
        <p>
          Regardless of the name attached, accountability does not rest on trust:
          contributions are governed by published{' '}
          <a href="/terms/contributor" className="text-accent underline">
            contributor terms
          </a>
          , moderation actions are logged, and anything you believe is wrong has a{' '}
          <a href="/report" className="text-accent underline">
            place to be reported
          </a>
          .
        </p>
      </Section>

      <Section title="How it is funded">
        <p>
          {SITE_NAME} takes no money to show you anything. Nothing — no corpus, no
          search, no evidence, no download — is ever behind a login or a payment.
          There is no advertising and no tracking of what you read.
        </p>
        <p data-funding-pending="true">
          The funding model is still being settled: the maintainer has not yet
          finalised whether to operate under a charity or community-interest
          registration before accepting donations, a decision that affects tax
          treatment and must be made before any payments are wired. Until then the
          project is run at its own small cost. When donations open they will fund
          hosting and data work only, and a login will still gate nothing but a
          user&rsquo;s own private work.
        </p>
      </Section>

      <Section title="Editorial policy">
        <p>
          Six provenance layers exist, and every rendered element carries exactly
          one: <strong>Quranic text</strong> (immutable, Tanzil),{' '}
          <strong>computed</strong> (derived from the corpus, reproducible),{' '}
          <strong>morphology</strong> (external annotation, Leeds QAC, GPL),{' '}
          <strong>translation</strong> (attributed human editions),{' '}
          <strong>editorial</strong> (our own investigations), and{' '}
          <strong>community</strong> (contributed responses). The tag is enforced in
          the component layer, not left to whoever wrote the page.
        </p>
        <p>
          Investigations are structured, not free-form opinion: each is a falsifiable
          claim with a runnable query, pinned evidence, and its own required
          counter-evidence. Responses must declare a type and cite evidence.
          Corrections are reviewed by a person and, where they touch the data, ship
          as a new immutable corpus version rather than a silent edit — so every
          citation made against an older version still resolves.
        </p>
      </Section>

      <footer className="mt-10 border-t border-line pt-5 text-[13px] leading-relaxed text-ink3">
        <p>
          For the full list of sources, licences and credits, see the{' '}
          <a href="/colophon" className="text-accent underline">
            colophon
          </a>
          . For the method behind every figure, see{' '}
          <a href="/method" className="text-accent underline">
            how this is built
          </a>
          . For the promise that URLs never break, see the{' '}
          <a href="/identifiers" className="text-accent underline">
            identifier policy
          </a>
          .
        </p>
      </footer>
    </article>
  );
}
