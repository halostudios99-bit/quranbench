import type { Metadata } from 'next';

import { SearchBar } from '@/components/SearchBar';

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: true },
};

// The 404. Public URLs are meant to be permanent, so a miss is worth turning into
// a way forward: search the corpus, or jump to the main entry points. Rendered in
// the site chrome (layout wraps it) with no internal detail exposed.
const LINKS: { href: string; label: string }[] = [
  { href: '/', label: 'Home' },
  { href: '/search', label: 'Search the corpus' },
  { href: '/1/1', label: 'Read the Qur’an' },
  { href: '/investigations', label: 'Investigations' },
  { href: '/method', label: 'How the method works' },
  { href: '/about', label: 'About quranbench' },
];

export default function NotFound() {
  return (
    <div className="mx-auto max-w-reader py-8">
      <p className="text-[13px] font-medium uppercase tracking-wide text-ink3">
        404
      </p>
      <h1 className="mt-1 text-[26px] font-semibold tracking-tight text-ink">
        This page could not be found
      </h1>
      <p className="mb-8 mt-2 text-[16px] leading-relaxed text-ink2">
        The address does not resolve to a surah, verse, word, root or
        investigation. Search the corpus, or start from one of these:
      </p>

      <SearchBar />

      <nav aria-label="Site" className="mt-8">
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-[15px]">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="text-accent underline underline-offset-2"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
