import type { Token as TokenRecord } from '@quranbench/corpus';

import { wordHref } from '@/lib/addressing';

// The one renderer for an Arabic word. Every token is a permanent, addressable
// research object, so it renders as a link to its word page. No motion touches the
// glyph — the highlight is an instant background change, an interface affordance,
// not an animation of scripture. Touch target >= 44px.
//
// The hover/focus tooltip (gloss, transliteration, root) is progressive
// enhancement layered on by a single global controller (<TokenTooltip>) reading
// the data-* attributes below. All the data ships in the page — the tooltip never
// fetches — and with JavaScript off the token is simply a link to its word page,
// which is the full, accessible view. Putting the data here, in the one renderer,
// is what makes the tooltip appear in the reader, search results and investigation
// evidence without any of those surfaces being touched.

interface TokenProps {
  token: TokenRecord;
  /** Visual size; all sizes stay >= 24px per the design system. */
  size?: 'reading' | 'compact';
  /**
   * Mark this token as the subject of the surrounding page (its word page, or a
   * root occurrence). The highlight is an instant background change, not a
   * transition — the Arabic is emphasised, never animated (design-system §3).
   */
  highlighted?: boolean;
}

export function Token({
  token,
  size = 'reading',
  highlighted = false,
}: TokenProps) {
  const m = token.morphology;
  return (
    <a
      href={wordHref(token.id)}
      data-token-id={token.id}
      data-size={size}
      data-highlight={highlighted ? 'true' : undefined}
      aria-current={highlighted ? 'true' : undefined}
      className="qb-token"
      // Tooltip payload — only set where a value exists, so the controller can
      // tell a genuinely absent field from an empty one.
      data-gloss={m.gloss ?? undefined}
      data-translit={m.transliteration ?? undefined}
      data-translit-source={m.transliteration_source ?? undefined}
      data-root={m.root ?? undefined}
      data-root-slug={m.root_slug ?? undefined}
      data-root-count={m.root_occurrences ?? undefined}
    >
      {token.text_uthmani}
    </a>
  );
}
