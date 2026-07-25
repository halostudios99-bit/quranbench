import type { CSSProperties } from 'react';

// Shared class strings for the auth forms, so signup and signin render
// identically without repeating Tailwind soup. Colour is always a CSS custom
// property (design-system §2) — the amber alert uses the editorial provenance
// variables via inline style because those tokens are not in the Tailwind map.

export const labelClass = 'text-[14px] font-medium text-ink';

export const fieldClass =
  'rounded-md border border-line bg-panel px-3 py-2.5 text-[15px] text-ink outline-none focus-visible:border-accent-line focus-visible:ring-2 focus-visible:ring-accent-line';

export const formButtonClass =
  'rounded-md bg-accent px-4 py-2.5 text-[15px] font-medium text-on-accent hover:opacity-90 disabled:opacity-60';

export const alertClass = 'rounded-md border px-3 py-2 text-[14px]';

export const alertStyle: CSSProperties = {
  borderColor: 'var(--prov-editorial-line)',
  background: 'var(--prov-editorial-bg)',
  color: 'var(--prov-editorial-fg)',
};

export const noticeStyle: CSSProperties = {
  borderColor: 'var(--prov-computed-line)',
  background: 'var(--prov-computed-bg)',
  color: 'var(--prov-computed-fg)',
};
