'use client';

import { useEffect } from 'react';

// `/` focuses search from anywhere (design-system §6). Pure enhancement — the
// input is reachable by tab and works without this.
export function SearchShortcut() {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== '/' || event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const input = document.getElementById('q') as HTMLInputElement | null;
      if (input) {
        event.preventDefault();
        input.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return null;
}
