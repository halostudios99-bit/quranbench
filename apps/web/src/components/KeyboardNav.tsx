'use client';

import { useEffect, useRef } from 'react';

// Keyboard navigation across tokens (design-system §6; workplan item 14). Mounted
// once in the root layout, it listens through the window so a token anywhere —
// reader, search results, root occurrences — is reachable by keyboard with no
// per-surface code. Tokens are already links (Token.tsx), so they focus on Tab and
// open on Enter natively; this adds arrow-key movement between them, a `/` shortcut
// to search, and a polite screen-reader announcement of the word focus lands on.
//
// Arrow keys act ONLY while a token is focused, so ordinary page scrolling is never
// hijacked. Because the Arabic reads right-to-left, ArrowLeft/ArrowDown move forward
// (to the visually-left, later token) and ArrowRight/ArrowUp move back. With
// JavaScript disabled none of this mounts and Tab + Enter still work.

function tokenLinks(): HTMLAnchorElement[] {
  return Array.from(
    document.querySelectorAll<HTMLAnchorElement>('a[data-token-id]'),
  );
}

function isTextField(el: EventTarget | null): boolean {
  return (
    el instanceof HTMLElement &&
    /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)
  );
}

export function KeyboardNav() {
  const liveRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function announce(token: HTMLElement) {
      const region = liveRef.current;
      if (!region) return;
      const translit = token.dataset.translit;
      const gloss = token.dataset.gloss;
      const parts = [translit, gloss].filter(Boolean);
      region.textContent = parts.length > 0 ? parts.join(' — ') : 'word';
    }

    function focusToken(token: HTMLAnchorElement) {
      token.focus();
      announce(token);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey)
        return;

      if (event.key === '/') {
        if (isTextField(event.target)) return;
        event.preventDefault();
        const input = document.getElementById('q') as HTMLInputElement | null;
        if (input) input.focus();
        else window.location.assign('/search');
        return;
      }

      const active = document.activeElement;
      if (!(active instanceof HTMLElement) || active.dataset.tokenId === undefined)
        return;

      let direction = 0;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') direction = 1;
      else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') direction = -1;
      else return;

      const tokens = tokenLinks();
      const index = tokens.indexOf(active as HTMLAnchorElement);
      if (index === -1) return;
      const next = tokens[index + direction];
      if (!next) return;
      event.preventDefault();
      focusToken(next);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div
      ref={liveRef}
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
      data-testid="token-announcer"
    />
  );
}
