// Inline SVG icons — no icon dependency, no emoji (design-system §7). Stroke
// follows currentColor so icons inherit the button's text colour in both modes.

type IconName =
  | 'copy'
  | 'link'
  | 'share'
  | 'quote'
  | 'sun'
  | 'moon'
  | 'search'
  | 'chevron'
  | 'settings'
  | 'close';

const PATHS: Record<IconName, React.ReactNode> = {
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h8" />
    </>
  ),
  link: (
    <>
      <path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" />
      <path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" />
    </>
  ),
  share: (
    <>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
    </>
  ),
  quote: (
    <>
      <path d="M7 7H4a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h3l-2 4M18 7h-3a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h3l-2 4" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </>
  ),
  chevron: <path d="M9 6l6 6-6 6" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5l1.4 2.3 2.6-.5.5 2.6 2.3 1.4-1.3 2.3 1.3 2.3-2.3 1.4-.5 2.6-2.6-.5L12 21.5l-1.4-2.3-2.6.5-.5-2.6-2.3-1.4 1.3-2.3-1.3-2.3 2.3-1.4.5-2.6 2.6.5z" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6L6 18" />,
};

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
