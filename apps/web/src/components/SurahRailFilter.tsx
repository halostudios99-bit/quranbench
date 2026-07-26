'use client';

import { useEffect, useRef, useState } from 'react';

import { Icon } from './Icon';

// Filters the surah rail by hiding list items in the DOM.
//
// Two deliberate choices. First, it filters the server-rendered list rather than
// re-rendering it, so the 114 surahs are never serialised into the page payload a
// second time just to power a text box. Second, it renders an inert box of the
// same height until it has mounted: a control that does nothing without
// JavaScript would be a lie, and swapping in a taller control after hydration
// would shift the list under the reader's cursor.

export function SurahRailFilter() {
  const [mounted, setMounted] = useState(false);
  const [value, setValue] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    const nav = rootRef.current?.closest('nav');
    if (!nav) return;

    const needle = value.trim().toLowerCase();
    let shown = 0;
    for (const item of nav.querySelectorAll<HTMLElement>('[data-surah-item]')) {
      const hay = item.dataset['surahSearch'] ?? '';
      const match = needle === '' || hay.includes(needle);
      item.hidden = !match;
      if (match) shown += 1;
    }
    const empty = nav.querySelector<HTMLElement>('[data-surah-empty]');
    if (empty) empty.hidden = shown > 0;
  }, [value, mounted]);

  return (
    <div ref={rootRef} className="px-1 pb-2">
      {mounted ? (
        <div className="qb-field flex items-center gap-2 rounded-lg border border-line2 bg-bg px-2.5">
          <span className="text-ink3" aria-hidden="true">
            <Icon name="search" size={14} />
          </span>
          <input
            type="search"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Filter surahs"
            aria-label="Filter surahs by name or number"
            className="h-9 w-full bg-transparent text-[13px] text-ink outline-none placeholder:text-ink3"
          />
        </div>
      ) : (
        // Height-matched placeholder: same 36px box, no control to click.
        <div className="h-9 rounded-lg border border-line" aria-hidden="true" />
      )}
    </div>
  );
}
