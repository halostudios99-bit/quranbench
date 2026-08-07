'use client';

import { useEffect, useRef, useState } from 'react';

// The autosuggest layer over the search input. Progressive enhancement only:
// this component renders the same <input> the server form had, and the form's
// plain GET submit keeps working if this script never runs (rule 3). The
// dropdown follows the WAI-ARIA combobox pattern — arrow keys move, Enter
// selects, Escape closes, and everything is mouse-reachable too.

interface Suggestion {
  type: 'surah' | 'verse' | 'root' | 'word' | 'gloss';
  label: string;
  detail: string;
  href?: string;
  q?: string;
}

const TYPE_LABEL: Record<Suggestion['type'], string> = {
  surah: 'surah',
  verse: 'verse',
  root: 'root',
  word: 'word',
  gloss: 'english',
};

export function SearchSuggest({ defaultValue = '' }: { defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch suggestions, debounced per keystroke; abort the stale request so a
  // slow response for "za" can never overwrite the results for "zakat".
  function query(q: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) {
      setItems([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch(`/api/suggest?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as { suggestions: Suggestion[] };
        setItems(data.suggestions);
        setOpen(data.suggestions.length > 0);
        setActive(-1);
      } catch {
        // aborted or offline — the plain form still works
      }
    }, 150);
  }

  function choose(item: Suggestion) {
    if (item.href) {
      window.location.assign(item.href);
      return;
    }
    if (item.q) {
      setValue(item.q);
      setOpen(false);
      // Submit the surrounding server-rendered form with the chosen query.
      inputRef.current?.form?.requestSubmit();
    }
  }

  // Close when clicking anywhere else.
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || items.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => (a + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (a <= 0 ? items.length - 1 : a - 1));
    } else if (e.key === 'Enter') {
      if (active >= 0 && items[active]) {
        e.preventDefault();
        choose(items[active]);
      }
      // active === -1: let the form submit the typed query as always
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActive(-1);
    }
  }

  return (
    <div ref={wrapRef} className="relative w-full">
      <input
        ref={inputRef}
        id="q"
        name="q"
        type="search"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          query(e.target.value);
        }}
        onFocus={() => {
          if (items.length > 0 && value.trim()) setOpen(true);
        }}
        onKeyDown={onKeyDown}
        placeholder="Arabic word, root, or query…"
        aria-label="Search the Quran corpus"
        role="combobox"
        aria-expanded={open}
        aria-controls="search-suggestions"
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `suggestion-${active}` : undefined}
        autoComplete="off"
        className="h-13 min-h-[52px] w-full bg-transparent py-3 text-[16px] text-ink outline-none placeholder:text-ink3"
      />
      {open ? (
        <ul
          id="search-suggestions"
          role="listbox"
          aria-label="Search suggestions"
          className="absolute left-[-2.75rem] right-0 top-[calc(100%+10px)] z-30 overflow-hidden rounded-lg border border-line2 bg-panel shadow-lg sm:left-[-2.75rem]"
        >
          {items.map((item, i) => (
            <li
              key={`${item.type}-${item.label}`}
              id={`suggestion-${i}`}
              role="option"
              aria-selected={i === active}
              onPointerDown={(e) => {
                // pointerdown, not click: the input's blur must not close the
                // list before the selection lands.
                e.preventDefault();
                choose(item);
              }}
              onPointerMove={() => setActive(i)}
              className={`flex cursor-pointer items-baseline justify-between gap-3 px-4 py-2.5 ${
                i === active ? 'bg-soft' : ''
              }`}
            >
              <span className="flex min-w-0 items-baseline gap-2">
                <span
                  dir="auto"
                  className={`truncate text-[15px] text-ink ${
                    item.type === 'word' || item.type === 'root' ? 'quran text-[17px]' : ''
                  }`}
                >
                  {item.label}
                </span>
                <span className="shrink-0 text-[12px] text-ink3">{item.detail}</span>
              </span>
              <span className="shrink-0 rounded-full bg-soft px-2 py-0.5 text-[11px] text-ink3">
                {TYPE_LABEL[item.type]}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
