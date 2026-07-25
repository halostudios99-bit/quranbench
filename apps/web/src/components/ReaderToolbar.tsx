'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

import {
  ARABIC_SIZES,
  arabicScale,
  DISPLAY_COOKIE,
  DISPLAY_LABELS,
  DISPLAY_MODES,
  SIZE_COOKIE,
  SIZE_LABELS,
  serialiseEditions,
  TRANSLATION_COOKIE,
  type ArabicSize,
  type DisplayMode,
  type ReaderPrefs,
} from '@/lib/reader-prefs';
import { saveReaderPrefs } from '@/app/reader-actions';

// The reader toolbar: which translations are shown, the display mode (Arabic /
// Arabic + translation / translation only) and the Arabic text size. Modelled on
// quran.com's translation panel — grouped by language, multi-select, filterable,
// with a live count.
//
// Progressive enhancement is the whole design. The server renders the same three
// controls as one plain GET <form> that posts to /api/reader-prefs; with no
// JavaScript it submits and the page re-renders with the new preferences. When
// this component mounts it takes over: preferences are written to cookies directly
// (and mirrored to the account when signed in), Arabic size is applied instantly
// via a CSS custom property with no re-render, and the translations panel becomes
// a keyboard-navigable popover with a focus trap and Esc-to-close. No content is
// ever gated — every edition is server-rendered and complete without JavaScript.

const ONE_YEAR = 60 * 60 * 24 * 365;

export interface ToolbarEdition {
  id: string;
  translator: string;
  year: number;
  licence: string;
  language: string;
}

interface ReaderToolbarProps {
  /** Every available edition, in reading (manifest) order. */
  editions: ToolbarEdition[];
  /** The current resolved preferences (editions undefined = all shown). */
  prefs: ReaderPrefs;
  /** Whether a signed-in reader should have changes mirrored to their profile. */
  signedIn: boolean;
  /** Same-origin path to return to after a no-JS form submit. */
  returnPath: string;
}

function writeCookie(name: string, value: string): void {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
}

/** Set the reader's Arabic scale live, with no re-render (design-system §4). */
function applyScale(size: ArabicSize): void {
  const root = document.querySelector<HTMLElement>('[data-reader-root]');
  root?.style.setProperty('--qb-arabic-scale', String(arabicScale(size)));
}

export function ReaderToolbar({
  editions,
  prefs,
  signedIn,
  returnPath,
}: ReaderToolbarProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const allIds = editions.map((e) => e.id);

  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(prefs.editions ?? allIds),
  );
  const [display, setDisplay] = useState<DisplayMode>(prefs.display);
  const [size, setSize] = useState<ArabicSize>(prefs.size);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');

  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => setMounted(true), []);

  const persist = useCallback(
    (next: ReaderPrefs) => {
      if (signedIn) void saveReaderPrefs(next).catch(() => {});
    },
    [signedIn],
  );

  const commitEditions = useCallback(
    (next: Set<string>) => {
      setSelected(next);
      const value = serialiseEditions(next, allIds);
      writeCookie(TRANSLATION_COOKIE, value);
      persist({
        editions: value === 'all' ? undefined : allIds.filter((id) => next.has(id)),
        display,
        size,
      });
      router.refresh();
    },
    [allIds, display, size, persist, router],
  );

  function toggleEdition(id: string): void {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    commitEditions(next);
  }

  function chooseDisplay(mode: DisplayMode): void {
    setDisplay(mode);
    writeCookie(DISPLAY_COOKIE, mode);
    persist({
      editions: selected.size >= allIds.length ? undefined : allIds.filter((id) => selected.has(id)),
      display: mode,
      size,
    });
    router.refresh();
  }

  function chooseSize(next: ArabicSize): void {
    setSize(next);
    applyScale(next); // instant, no re-render
    writeCookie(SIZE_COOKIE, String(next));
    persist({
      editions: selected.size >= allIds.length ? undefined : allIds.filter((id) => selected.has(id)),
      display,
      size: next,
    });
  }

  // Focus trap + Esc for the open translations popover.
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    const first = panel.querySelector<HTMLElement>(
      'input, button, [tabindex]:not([tabindex="-1"])',
    );
    first?.focus();

    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusable = panel!.querySelectorAll<HTMLElement>(
        'input, button, [href], [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const list = Array.from(focusable);
      const firstEl = list[0]!;
      const lastEl = list[list.length - 1]!;
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    }
    function onClickOutside(e: MouseEvent): void {
      if (
        !panel!.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      )
        setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClickOutside);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, [open]);

  // Group editions by language, preserving manifest order within each group.
  const groups = new Map<string, ToolbarEdition[]>();
  for (const e of editions) {
    const list = groups.get(e.language);
    if (list) list.push(e);
    else groups.set(e.language, [e]);
  }

  const filterLc = filter.trim().toLowerCase();
  const matches = (e: ToolbarEdition): boolean =>
    filterLc === '' ||
    e.translator.toLowerCase().includes(filterLc) ||
    e.language.toLowerCase().includes(filterLc) ||
    String(e.year).includes(filterLc);

  const count = selected.size;

  // ── No-JavaScript fallback: a plain GET form that submits to the route handler
  // and re-renders the page. Rendered until this component mounts, and it is what
  // a client with JavaScript disabled always sees.
  if (!mounted) {
    return (
      <form
        action="/api/reader-prefs"
        method="get"
        data-testid="reader-toolbar"
        className="mb-6 flex flex-col gap-4 rounded-xl border border-line bg-panel px-4 py-4"
      >
        <input type="hidden" name="return" value={returnPath} />
        <details className="text-[13px]">
          <summary className="cursor-pointer font-medium text-ink2">
            Translations ({count} of {editions.length})
          </summary>
          <div className="mt-3 flex flex-col gap-3">
            {[...groups.entries()].map(([language, list]) => (
              <fieldset key={language} className="flex flex-col gap-1.5">
                <legend className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-ink3">
                  {language}
                </legend>
                {list.map((e) => (
                  <label key={e.id} className="flex items-center gap-2 text-ink2">
                    <input
                      type="checkbox"
                      name="edition"
                      value={e.id}
                      defaultChecked={selected.has(e.id)}
                      className="h-4 w-4"
                    />
                    <span>
                      {e.translator}{' '}
                      <span className="text-ink3">
                        ({e.year}) · {e.licence}
                      </span>
                    </span>
                  </label>
                ))}
              </fieldset>
            ))}
          </div>
        </details>

        <DisplayField display={display} name="display" />
        <SizeField size={size} name="size" />

        <button
          type="submit"
          className="self-start rounded-lg border border-line bg-soft px-4 py-2 text-[14px] text-ink hover:border-line2"
        >
          Apply
        </button>
      </form>
    );
  }

  // ── Enhanced (JavaScript): live controls, no navigation.
  return (
    <div
      data-testid="reader-toolbar"
      className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-panel px-3 py-2.5"
    >
      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg border border-line px-3 py-2 text-[13px] text-ink2 hover:border-line2 hover:text-ink"
        >
          Translations{' '}
          <span className="text-ink3">
            ({count}/{editions.length})
          </span>
        </button>

        {open ? (
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-modal="false"
            aria-label="Choose translations"
            className="absolute z-20 mt-2 flex max-h-[70vh] w-80 max-w-[calc(100vw-2rem)] flex-col gap-3 overflow-auto rounded-xl border border-line2 bg-panel p-4 shadow-lg"
          >
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-ink">
                Translations
              </span>
              <span className="text-[12px] text-ink3">{count} selected</span>
            </div>
            <input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter translations"
              aria-label="Filter translations"
              className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-[13px] text-ink"
            />
            <div className="flex flex-col gap-3">
              {[...groups.entries()].map(([language, list]) => {
                const visible = list.filter(matches);
                if (visible.length === 0) return null;
                return (
                  <fieldset key={language} className="flex flex-col gap-1.5">
                    <legend className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink3">
                      {language}
                    </legend>
                    {visible.map((e) => (
                      <label
                        key={e.id}
                        className="flex items-start gap-2 text-[13px] text-ink2"
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(e.id)}
                          onChange={() => toggleEdition(e.id)}
                          className="mt-0.5 h-4 w-4 shrink-0"
                        />
                        <span>
                          {e.translator}{' '}
                          <span className="text-ink3">
                            ({e.year}) · {e.licence}
                          </span>
                        </span>
                      </label>
                    ))}
                  </fieldset>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      <div
        role="group"
        aria-label="Display mode"
        className="flex items-center overflow-hidden rounded-lg border border-line text-[13px]"
      >
        {DISPLAY_MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            aria-pressed={display === mode}
            onClick={() => chooseDisplay(mode)}
            className={`px-3 py-2 ${
              display === mode
                ? 'bg-accent-bg text-ink'
                : 'text-ink2 hover:text-ink'
            }`}
          >
            {DISPLAY_LABELS[mode]}
          </button>
        ))}
      </div>

      <div
        role="group"
        aria-label="Arabic size"
        className="flex items-center overflow-hidden rounded-lg border border-line text-[13px]"
      >
        {ARABIC_SIZES.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={size === s}
            aria-label={`Arabic size: ${SIZE_LABELS[s]}`}
            onClick={() => chooseSize(s)}
            className={`px-3 py-2 ${
              size === s ? 'bg-accent-bg text-ink' : 'text-ink2 hover:text-ink'
            }`}
          >
            <span aria-hidden="true" style={{ fontSize: `${11 + s * 2}px` }}>
              A
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function DisplayField({ display, name }: { display: DisplayMode; name: string }) {
  return (
    <fieldset className="flex flex-col gap-1.5 text-[13px]">
      <legend className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-ink3">
        Display
      </legend>
      {DISPLAY_MODES.map((mode) => (
        <label key={mode} className="flex items-center gap-2 text-ink2">
          <input
            type="radio"
            name={name}
            value={mode}
            defaultChecked={display === mode}
            className="h-4 w-4"
          />
          <span>{DISPLAY_LABELS[mode]}</span>
        </label>
      ))}
    </fieldset>
  );
}

function SizeField({ size, name }: { size: ArabicSize; name: string }) {
  return (
    <fieldset className="flex flex-col gap-1.5 text-[13px]">
      <legend className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-ink3">
        Arabic size
      </legend>
      {ARABIC_SIZES.map((s) => (
        <label key={s} className="flex items-center gap-2 text-ink2">
          <input
            type="radio"
            name={name}
            value={s}
            defaultChecked={size === s}
            className="h-4 w-4"
          />
          <span>{SIZE_LABELS[s]}</span>
        </label>
      ))}
    </fieldset>
  );
}
