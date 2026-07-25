'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// One controller for every token tooltip on the page. It is mounted once in the
// root layout and listens through event delegation, so a token anywhere — reader,
// search results, investigation evidence — gets the tooltip with no per-surface
// code. All the data is already in the token's data-* attributes (see Token.tsx);
// nothing is fetched. With JavaScript disabled this component never mounts and the
// token stays a plain link to its word page, the full accessible view.
//
// Desktop (fine pointer / keyboard): a floating popover, shown after a 200ms hover
// delay, fading in over 120ms — the tooltip fades, the Arabic never moves. Mobile
// (coarse pointer): a tap opens a compact bottom sheet instead of a box under the
// thumb. Esc dismisses; focus shows it. Motion is disabled under reduced-motion.

interface TooltipData {
  tokenId: string;
  gloss: string | null;
  translit: string | null;
  translitSource: string | null;
  root: string | null;
  rootSlug: string | null;
  rootCount: string | null;
}

const SHOW_DELAY = 200;

function read(el: HTMLElement): TooltipData | null {
  const tokenId = el.dataset.tokenId;
  if (!tokenId) return null;
  const gloss = el.dataset.gloss ?? null;
  const translit = el.dataset.translit ?? null;
  const root = el.dataset.root ?? null;
  // Nothing worth showing — let the link behave normally.
  if (!gloss && !translit && !root) return null;
  return {
    tokenId,
    gloss,
    translit,
    translitSource: el.dataset.translitSource ?? null,
    root,
    rootSlug: el.dataset.rootSlug ?? null,
    rootCount: el.dataset.rootCount ?? null,
  };
}

function translitSourceLabel(source: string | null): string {
  if (source === 'qac-word-transliteration')
    return 'transliteration: Quranic Arabic Corpus';
  if (source && source.startsWith('computed'))
    return 'transliteration: computed (DIN 31635)';
  return 'transliteration';
}

export function TokenTooltip() {
  const [data, setData] = useState<TooltipData | null>(null);
  const [mode, setMode] = useState<'popover' | 'sheet'>('popover');
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const anchorRef = useRef<HTMLElement | null>(null);
  const showTimer = useRef<number | null>(null);
  const hideTimer = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (showTimer.current !== null) window.clearTimeout(showTimer.current);
    if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    showTimer.current = null;
    hideTimer.current = null;
  }, []);

  const dismiss = useCallback(() => {
    clearTimers();
    if (anchorRef.current)
      anchorRef.current.removeAttribute('aria-describedby');
    anchorRef.current = null;
    setData(null);
  }, [clearTimers]);

  const openFor = useCallback(
    (el: HTMLElement, nextMode: 'popover' | 'sheet') => {
      const next = read(el);
      if (!next) return;
      clearTimers();
      anchorRef.current = el;
      el.setAttribute('aria-describedby', 'qb-token-tooltip');
      setMode(nextMode);
      setData(next);
    },
    [clearTimers],
  );

  // Position the popover after it renders: above the token when it fits, else
  // below (flip); clamped into the viewport (no overflow, no layout shift).
  useEffect(() => {
    if (!data || mode !== 'popover') return;
    const pop = popoverRef.current;
    const anchor = anchorRef.current;
    if (!pop || !anchor) return;
    const gap = 8;
    const margin = 8;
    const a = anchor.getBoundingClientRect();
    const p = pop.getBoundingClientRect();
    let top = a.top - p.height - gap;
    if (top < margin) top = a.bottom + gap; // flip below
    let left = a.left + a.width / 2 - p.width / 2;
    left = Math.max(
      margin,
      Math.min(left, window.innerWidth - p.width - margin),
    );
    pop.style.top = `${Math.round(top)}px`;
    pop.style.left = `${Math.round(left)}px`;
    pop.dataset.shown = 'true';
  }, [data, mode]);

  useEffect(() => {
    const isCoarse =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(pointer: coarse)').matches;

    function tokenFrom(target: EventTarget | null): HTMLElement | null {
      if (!(target instanceof Element)) return null;
      const el = target.closest('[data-token-id]');
      return el instanceof HTMLElement ? el : null;
    }

    function onPointerOver(e: PointerEvent) {
      if (e.pointerType === 'touch') return;
      const token = tokenFrom(e.target);
      if (!token || token === anchorRef.current) return;
      clearTimers();
      showTimer.current = window.setTimeout(
        () => openFor(token, 'popover'),
        SHOW_DELAY,
      );
    }

    function onPointerOut(e: PointerEvent) {
      if (e.pointerType === 'touch') return;
      const related = e.relatedTarget;
      // Keep it open while the pointer is over the token or the tooltip itself.
      if (related instanceof Node) {
        if (popoverRef.current?.contains(related)) return;
        if (anchorRef.current?.contains(related)) return;
      }
      if (showTimer.current !== null) window.clearTimeout(showTimer.current);
      hideTimer.current = window.setTimeout(dismiss, 80);
    }

    function onFocusIn(e: FocusEvent) {
      const token = tokenFrom(e.target);
      if (token) {
        openFor(token, 'popover');
        return;
      }
      // Focus moving into the tooltip's own link keeps it open.
      if (popoverRef.current?.contains(e.target as Node)) return;
      dismiss();
    }

    function onClick(e: MouseEvent) {
      if (!isCoarse) return;
      const token = tokenFrom(e.target);
      if (!token) return;
      if (!read(token)) return;
      // On touch, the first tap opens the sheet instead of navigating; the sheet
      // offers the word-page link explicitly.
      e.preventDefault();
      openFor(token, 'sheet');
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && anchorRef.current) {
        const toFocus = anchorRef.current;
        dismiss();
        toFocus.focus();
      }
    }

    document.addEventListener('pointerover', onPointerOver);
    document.addEventListener('pointerout', onPointerOut);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerover', onPointerOver);
      document.removeEventListener('pointerout', onPointerOut);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [clearTimers, dismiss, openFor]);

  if (!data) return null;

  const body = (
    <div className="qb-tt-body">
      {data.translit ? (
        <p className="qb-tt-translit" lang="ar-Latn">
          {data.translit}
        </p>
      ) : null}
      {data.gloss ? <p className="qb-tt-gloss">{data.gloss}</p> : null}
      {data.root && data.rootSlug ? (
        <a className="qb-tt-root" href={`/root/${data.rootSlug}`}>
          <span className="qb-tt-root-label">Root</span>
          <span lang="ar" dir="rtl" className="quran qb-tt-root-ar">
            {data.root}
          </span>
          {data.rootCount ? (
            <span className="qb-tt-root-count">
              {data.rootCount} occurrence{data.rootCount === '1' ? '' : 's'} →
            </span>
          ) : null}
        </a>
      ) : null}
      <p className="qb-tt-src">
        {data.gloss
          ? 'gloss: Quranic Arabic Corpus (Leeds, GPL)'
          : translitSourceLabel(data.translitSource)}
      </p>
    </div>
  );

  if (mode === 'sheet') {
    return (
      <div className="qb-tt-sheet-scrim" onClick={dismiss} role="presentation">
        <div
          id="qb-token-tooltip"
          role="dialog"
          aria-label="Word details"
          className="qb-tt-sheet"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="qb-tt-grip" aria-hidden="true" />
          {body}
          <a
            className="qb-tt-sheet-word"
            href={`/word/${encodeURIComponent(data.tokenId)}`}
          >
            Open the full word page →
          </a>
          <button type="button" className="qb-tt-sheet-close" onClick={dismiss}>
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={popoverRef}
      id="qb-token-tooltip"
      role="tooltip"
      className="qb-tt-popover"
    >
      {body}
    </div>
  );
}
