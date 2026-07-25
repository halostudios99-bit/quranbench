import type { Token as TokenRecord } from '@quranbench/corpus';

import { wordHref } from '@/lib/addressing';

// The one renderer for an Arabic word. Every token is a permanent, addressable
// research object, so it renders as a link to its word page (built next prompt).
// No motion touches the glyph — the highlight is an instant background change, an
// interface affordance, not an animation of scripture. Touch target >= 44px.

interface TokenProps {
  token: TokenRecord;
  /** Visual size; all sizes stay >= 24px per the design system. */
  size?: 'reading' | 'compact';
}

export function Token({ token, size = 'reading' }: TokenProps) {
  return (
    <a href={wordHref(token.id)} data-token-id={token.id} data-size={size} className="qb-token">
      {token.text_uthmani}
    </a>
  );
}
