import { getCorpus, getTextEdition } from '@/server/corpus';
import { ProvenanceTag } from './ProvenanceTag';

// Every link resolves to a page that exists, so the footer is never a dead end.
const SITE_LINKS: { href: string; label: string }[] = [
  { href: '/about', label: 'About' },
  { href: '/method', label: 'Method' },
  { href: '/colophon', label: 'Colophon' },
  { href: '/identifiers', label: 'Identifiers' },
  { href: '/data', label: 'Data' },
  { href: '/random', label: 'Random word' },
  { href: '/report', label: 'Report a correction' },
];

// The site-wide provenance line. Every page states which text edition and corpus
// version produced what it shows — reproducibility applied to the page itself.
export function SiteFooter() {
  const corpus = getCorpus();
  const edition = getTextEdition();
  return (
    <footer className="mt-16 border-t border-line bg-panel">
      <div className="mx-auto max-w-wrap px-5 py-7 sm:px-8">
        {/* These are a row of controls rather than links inside a sentence, so
            the WCAG 2.2 inline exception does not really apply to them. At
            13px they measured 21px tall; the vertical padding brings each to
            33px without changing the footer's visual rhythm. */}
        <nav
          aria-label="Site"
          className="mb-4 flex flex-wrap gap-x-5 text-[13px] text-ink2"
        >
          {SITE_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="inline-block py-1.5 hover:text-ink"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <ProvenanceTag layer="quran" note={edition} />
          <ProvenanceTag layer="external" note="Leeds QAC (GPL)" />
        </div>
        <dl className="flex flex-wrap gap-x-8 gap-y-2 text-[13px] text-ink3">
          <div className="flex gap-1.5">
            <dt>Text:</dt>
            <dd className="text-ink2">{edition}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt>Corpus:</dt>
            <dd className="text-ink2">v{corpus.version} · open data</dd>
          </div>
          <div className="flex gap-1.5">
            <dt>Tashkeel counted:</dt>
            <dd className="text-ink2">no</dd>
          </div>
          <div className="flex gap-1.5">
            <dt>Numbering:</dt>
            <dd className="text-ink2">{corpus.manifest.numbering.active}</dd>
          </div>
        </dl>
        <p className="mt-4 max-w-2xl text-[12px] leading-relaxed text-ink3">
          Quranic text is immutable and attributed to Tanzil. Morphology is derived from the Leeds
          Quranic Arabic Corpus and is licensed GPL-2.0-or-later. Do not accept an interpretation —
          open the evidence and reproduce the search yourself.
        </p>
      </div>
    </footer>
  );
}
