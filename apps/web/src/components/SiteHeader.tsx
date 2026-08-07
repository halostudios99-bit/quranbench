import { HeaderAuth } from './HeaderAuth';
import { Icon } from './Icon';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';

// Only routes that exist this prompt are linked, so no navigation is a dead end.
const LINKS: { href: string; label: string }[] = [
  { href: '/', label: 'Read' },
  { href: '/search', label: 'Search' },
];

// The header has two layouts because one row cannot hold this much at 360px.
//
// Measured before the fix: the inline nav needed 408px in a 360px viewport, so
// "Create account" was clipped by the screen edge and the theme toggle sat
// entirely off-screen at x=381–408. The page could not be scrolled sideways to
// reach them (the document is not horizontally scrollable), so on a phone the
// theme toggle was simply unreachable and the primary call to action was cut in
// half.
//
// Below `sm` the links collapse into a disclosure. It is a <details> element, not
// a JavaScript drawer, because every page must work with JavaScript disabled —
// and because the menu is also where phone users get surah navigation, which the
// desktop rail provides and mobile otherwise had no equivalent for.
//
// The markup is duplicated rather than reflowed: only one branch is ever
// rendered at a given width, the link markup is static and small, and
// HeaderAuth shares a single session request between its two instances.

function NavLinks({ stacked }: { stacked: boolean }) {
  return (
    <>
      {LINKS.map((link) => (
        <a
          key={link.href}
          href={link.href}
          className={
            stacked
              ? 'block rounded-md px-2.5 py-2.5 text-[15px] text-ink2 hover:bg-soft hover:text-ink'
              : 'rounded-md px-2.5 py-2 text-[14px] text-ink2 hover:text-ink'
          }
        >
          {link.label}
        </a>
      ))}
    </>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-panel/95 backdrop-blur">
      <div className="relative mx-auto flex h-15 min-h-[60px] max-w-wrap items-center justify-between gap-2 px-5 sm:px-8">
        <a href="/" aria-label="QuranBench — home" className="min-w-0">
          <Logo tagline />
        </a>

        {/* Wide viewports: everything inline. */}
        <nav
          aria-label="Primary"
          className="hidden items-center gap-1 sm:flex sm:gap-2"
        >
          <NavLinks stacked={false} />
          <HeaderAuth />
          <ThemeToggle />
        </nav>

        {/* Narrow viewports: search stays one tap away, everything else folds
            into the disclosure. */}
        <div className="flex items-center gap-1 sm:hidden">
          <a
            href="/search"
            data-testid="mobile-search"
            className="flex h-11 w-11 items-center justify-center rounded-md text-ink2 hover:bg-soft hover:text-ink"
          >
            <Icon name="search" size={18} />
            <span className="sr-only">Search</span>
          </a>

          <details data-testid="mobile-menu">
            <summary
              className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-md text-ink2 hover:bg-soft hover:text-ink [&::-webkit-details-marker]:hidden"
              aria-label="Menu"
            >
              <Icon name="menu" size={20} />
            </summary>
            <div className="absolute inset-x-0 top-full z-40 border-b border-line bg-panel px-5 py-3 shadow-lg">
              <nav aria-label="Menu" className="flex flex-col gap-0.5">
                <NavLinks stacked />
                <a
                  href="/"
                  className="block rounded-md px-2.5 py-2.5 text-[15px] text-ink2 hover:bg-soft hover:text-ink"
                >
                  All surahs
                </a>
                <a
                  href="/data"
                  className="block rounded-md px-2.5 py-2.5 text-[15px] text-ink2 hover:bg-soft hover:text-ink"
                >
                  Data
                </a>
                <a
                  href="/method"
                  className="block rounded-md px-2.5 py-2.5 text-[15px] text-ink2 hover:bg-soft hover:text-ink"
                >
                  Method
                </a>
                <div className="mt-2 flex flex-col gap-1 border-t border-line pt-3">
                  <HeaderAuth stacked />
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-line pt-3">
                  <span className="px-2.5 text-[13px] text-ink3">Appearance</span>
                  <ThemeToggle />
                </div>
              </nav>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
