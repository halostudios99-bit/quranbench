import { getCorpus, getTextEdition } from '@/server/corpus';
import { LogoMark } from './Logo';

// The footer is the site's anchor: a deep ink-green ground — fixed colours,
// deliberately the same in light and dark mode, because it is the one surface
// that belongs to the brand rather than the theme — carrying a columned
// sitemap, the project's promise, and the provenance line every page owes its
// reader. Every link resolves to a page that exists, so the footer is never a
// dead end.

const COLUMNS: { heading: string; links: { href: string; label: string }[] }[] = [
  {
    heading: 'Explore',
    links: [
      { href: '/', label: 'All surahs' },
      { href: '/search', label: 'Search' },
      { href: '/compare', label: 'Compare translations' },
      { href: '/gloss', label: 'Reverse lookup' },
      { href: '/random', label: 'Random word' },
    ],
  },
  {
    heading: 'Research',
    links: [
      { href: '/investigations', label: 'Investigations' },
      { href: '/review', label: 'Review queue' },
      { href: '/method', label: 'Method' },
      { href: '/data', label: 'Data and downloads' },
      { href: '/identifiers', label: 'Identifiers' },
      { href: '/api', label: 'API' },
    ],
  },
  {
    heading: 'Community',
    links: [
      { href: '/report', label: 'Report a correction' },
      { href: '/donate', label: 'Donate' },
      { href: '/terms', label: 'Contributor terms' },
      { href: '/about', label: 'About' },
      { href: '/colophon', label: 'Colophon' },
    ],
  },
];

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-[#2a6a54] px-2.5 py-0.5 text-[11px] text-[#8fbfae]">
      {children}
    </span>
  );
}

export function SiteFooter() {
  const corpus = getCorpus();
  const edition = getTextEdition();
  return (
    <footer className="mt-16 bg-[#0c352a] text-[#cfe8dd]">
      <div className="mx-auto max-w-wrap px-5 py-10 sm:px-8">
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-[1.5fr_1fr_1fr_1fr] sm:gap-x-8">
          <div className="col-span-2 sm:col-span-1">
            <span className="flex items-center gap-2.5">
              <span className="text-[#5dcaa5]">
                <LogoMark height={30} />
              </span>
              <span className="text-[16px] font-semibold tracking-tight">
                <span className="text-[#f2efe8]">Quran</span>
                <span className="text-[#5dcaa5]">Bench</span>
              </span>
            </span>
            <p className="mt-3 max-w-[24ch] text-[13px] leading-relaxed text-[#8fbfae]">
              Do not accept an interpretation — open the evidence and reproduce
              the search yourself.
            </p>
            <a
              href="https://github.com/halostudios99-bit/quranbench"
              className="mt-3 inline-block py-1 text-[13px] text-[#cfe8dd] underline decoration-[#2a6a54] underline-offset-4 hover:text-white"
            >
              Source on GitHub
            </a>
          </div>
          {COLUMNS.map((col) => (
            <nav key={col.heading} aria-label={col.heading}>
              <h2 className="mb-2.5 text-[11px] font-medium uppercase tracking-[0.14em] text-[#8fbfae]">
                {col.heading}
              </h2>
              <ul className="flex flex-col">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      className="inline-block py-[5px] text-[13px] text-[#cfe8dd] hover:text-white"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-9 flex flex-wrap items-center gap-2 border-t border-[#1b4f40] pt-5">
          <Chip>Quranic text · {edition}</Chip>
          <Chip>Morphology · Leeds QAC (GPL)</Chip>
          <Chip>Corpus v{corpus.version} · open data</Chip>
          <span className="text-[11px] text-[#8fbfae] sm:ml-auto">
            Numbering: {corpus.manifest.numbering.active} · Tashkeel counted: no
          </span>
        </div>
        <p className="mt-4 max-w-2xl text-[12px] leading-relaxed text-[#8fbfae]">
          Quranic text is immutable and attributed to Tanzil. Morphology is
          derived from the Leeds Quranic Arabic Corpus and is licensed
          GPL-2.0-or-later.
        </p>
      </div>
    </footer>
  );
}
