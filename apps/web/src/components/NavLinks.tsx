'use client';

import { usePathname } from 'next/navigation';

// Header navigation with an active-page underline. A client component only so
// usePathname can mark the current page; it server-renders with the correct
// path on first paint, and with JavaScript off the links still work — the
// underline is the only enhancement.

const LINKS: { href: string; label: string; match: (p: string) => boolean }[] = [
  { href: '/', label: 'Read', match: (p) => p === '/' || /^\/\d+$/.test(p) },
  { href: '/search', label: 'Search', match: (p) => p.startsWith('/search') },
  {
    href: '/investigations',
    label: 'Investigations',
    match: (p) => p.startsWith('/investigations'),
  },
  { href: '/donate', label: 'Donate', match: (p) => p.startsWith('/donate') },
];

export function NavLinks({ stacked }: { stacked: boolean }) {
  const pathname = usePathname() ?? '';
  return (
    <>
      {LINKS.map((link) => {
        const active = link.match(pathname);
        if (stacked) {
          return (
            <a
              key={link.href}
              href={link.href}
              aria-current={active ? 'page' : undefined}
              className={`block rounded-md px-2.5 py-2.5 text-[15px] hover:bg-soft hover:text-ink ${
                active ? 'font-medium text-ink' : 'text-ink2'
              }`}
            >
              {link.label}
            </a>
          );
        }
        return (
          <a
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={`px-1 pb-1 pt-2 font-ui text-[12px] uppercase tracking-[0.12em] transition-colors ${
              active
                ? 'border-b-2 border-accent text-ink'
                : 'border-b-2 border-transparent text-ink2 hover:text-ink'
            }`}
          >
            {link.label}
          </a>
        );
      })}
    </>
  );
}
