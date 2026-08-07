import { HeaderAuth } from './HeaderAuth';
import { Icon } from './Icon';
import { Logo } from './Logo';
import { NavLinks } from './NavLinks';
import { ThemeToggle } from './ThemeToggle';

// The masthead. A 3px accent rule tops the page — the journal convention for
// "this is a publication, not an app shell" — and the primary nav is
// letter-spaced small caps with an underline on the current page (NavLinks).
//
// The header has two layouts because one row cannot hold this much at 360px.
// Below `sm` the links collapse into a disclosure. It is a <details> element,
// not a JavaScript drawer, because every page must work with JavaScript
// disabled — and because the menu is also where phone users get surah
// navigation, which the desktop rail provides and mobile otherwise had no
// equivalent for.
//
// The markup is duplicated rather than reflowed: only one branch is ever
// rendered at a given width, the link markup is static and small, and
// HeaderAuth shares a single session request between its two instances.

const MENU_EXTRAS: { href: string; label: string }[] = [
  { href: '/', label: 'All surahs' },
  { href: '/compare', label: 'Compare translations' },
  { href: '/data', label: 'Data' },
  { href: '/method', label: 'Method' },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-panel/95 backdrop-blur">
      <div className="h-[3px] bg-accent" aria-hidden="true" />
      <div className="relative mx-auto flex h-15 min-h-[60px] max-w-wrap items-center justify-between gap-2 px-5 sm:px-8">
        <a href="/" aria-label="QuranBench — home" className="min-w-0">
          <Logo tagline stacked />
        </a>

        {/* Wide viewports: everything inline. */}
        <nav
          aria-label="Primary"
          className="hidden items-center gap-1 sm:flex sm:gap-4"
        >
          <NavLinks stacked={false} />
          <span className="mx-1 hidden h-4 w-px bg-line lg:inline-block" aria-hidden="true" />
          <span className="flex items-center gap-1">
            <HeaderAuth />
            <ThemeToggle />
          </span>
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
                {MENU_EXTRAS.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    className="block rounded-md px-2.5 py-2.5 text-[15px] text-ink2 hover:bg-soft hover:text-ink"
                  >
                    {link.label}
                  </a>
                ))}
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
