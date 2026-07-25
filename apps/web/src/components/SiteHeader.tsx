import { SITE_NAME } from '@/lib/site';
import { HeaderAuth } from './HeaderAuth';
import { ThemeToggle } from './ThemeToggle';

// Only routes that exist this prompt are linked, so no navigation is a dead end.
const LINKS: { href: string; label: string }[] = [
  { href: '/', label: 'Read' },
  { href: '/search', label: 'Search' },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-panel/95 backdrop-blur">
      <div className="mx-auto flex h-15 min-h-[60px] max-w-wrap items-center justify-between px-5 sm:px-8">
        <a href="/" className="flex items-baseline gap-2">
          <span className="text-[17px] font-semibold tracking-tight text-ink">{SITE_NAME}</span>
          <span className="hidden text-[12px] text-ink3 sm:inline">a Quran research workbench</span>
        </a>
        <nav aria-label="Primary" className="flex items-center gap-1 sm:gap-2">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-md px-2.5 py-2 text-[14px] text-ink2 hover:text-ink"
            >
              {link.label}
            </a>
          ))}
          <HeaderAuth />
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
