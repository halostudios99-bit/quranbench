// The site logo: the favicon's mark (a bordered square of text lines — the
// corpus on the bench) redrawn for header scale, beside a two-tone wordmark.
// Inline SVG with currentColor so it follows the theme; no image request, no
// font trickery, and it renders identically with JavaScript off.

export function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect
        x="2.25"
        y="2.25"
        width="19.5"
        height="19.5"
        rx="5"
        stroke="currentColor"
        strokeWidth="1.9"
      />
      <path
        d="M7.2 8.4h9.6M7.2 12h9.6M7.2 15.6h5.4"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Logo({ tagline = false }: { tagline?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span className="text-accent">
        <LogoMark />
      </span>
      <span className="flex min-w-0 items-baseline gap-2">
        <span className="truncate text-[17px] font-semibold tracking-tight">
          <span className="text-ink">Quran</span>
          <span className="text-accent">Bench</span>
        </span>
        {tagline ? (
          <span className="hidden text-[12px] text-ink3 lg:inline">
            a Quran research workbench
          </span>
        ) : null}
      </span>
    </span>
  );
}
