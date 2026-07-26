'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import {
  ARABIC_SIZES,
  arabicScale,
  defaultEditions,
  DEFAULT_DISPLAY,
  DEFAULT_SIZE,
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
import { Icon } from './Icon';

// The reader's settings: which translations are shown, the display mode (Arabic /
// Arabic + translation / translation only) and the Arabic text size.
//
// These live in a slide-over panel rather than a strip above the text. The reading
// column is the point of the page; a permanent control bar pushed the first ayah
// down the screen on every route. The panel is opened by one control in the reader
// header and is otherwise entirely out of the way.
//
// Progressive enhancement is the whole design. The server renders the same three
// controls as one plain GET <form> that submits to /api/reader-prefs; with no
// JavaScript it submits and the page re-renders with the new preferences. When
// this component mounts it takes over: preferences are written to cookies directly
// (and mirrored to the account when signed in), Arabic size is applied instantly
// via a CSS custom property with no re-render, and the panel becomes a modal
// dialog with a focus trap, Esc-to-close and focus restored to the trigger.
//
// No content is ever gated — every edition is server-rendered and complete without
// JavaScript. These preferences only choose what a given reader sees.

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
    (next: Set<string>, nextDisplay: DisplayMode, nextSize: ArabicSize) => {
      if (!signedIn) return;
      // Always store the resolved list, even when it is every edition: an absent
      // `editions` in a profile means "never chosen" and resolves to the default
      // single edition, so writing undefined here would undo a deliberate choice.
      void saveReaderPrefs({
        editions: allIds.filter((id) => next.has(id)),
        display: nextDisplay,
        size: nextSize,
      }).catch(() => {});
    },
    [allIds, signedIn],
  );

  const commitEditions = useCallback(
    (next: Set<string>) => {
      setSelected(next);
      writeCookie(TRANSLATION_COOKIE, serialiseEditions(next, allIds));
      persist(next, display, size);
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
    persist(selected, mode, size);
    router.refresh();
  }

  function chooseSize(next: ArabicSize): void {
    setSize(next);
    applyScale(next); // instant, no re-render
    writeCookie(SIZE_COOKIE, String(next));
    persist(selected, display, next);
  }

  /** Back to what a reader sees before they have chosen anything. */
  function reset(): void {
    const next = new Set(defaultEditions(allIds));
    setSelected(next);
    setDisplay(DEFAULT_DISPLAY);
    setSize(DEFAULT_SIZE);
    applyScale(DEFAULT_SIZE);
    writeCookie(TRANSLATION_COOKIE, serialiseEditions(next, allIds));
    writeCookie(DISPLAY_COOKIE, DEFAULT_DISPLAY);
    writeCookie(SIZE_COOKIE, String(DEFAULT_SIZE));
    persist(next, DEFAULT_DISPLAY, DEFAULT_SIZE);
    router.refresh();
  }

  function close(): void {
    setOpen(false);
    triggerRef.current?.focus();
  }

  // Focus trap, Esc, and a scroll lock for the open panel. The panel is a modal
  // dialog: while it is open the page behind it is inert to the keyboard.
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

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
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
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
  //
  // It is a *closed* <details> whose summary is the same height as the mounted
  // trigger row. That matters: this is the server-rendered markup, so if it were
  // taller than what replaces it, every reader page would visibly collapse by that
  // difference the moment hydration finished. Same height in, same height out —
  // no layout shift, nothing to see.
  if (!mounted) {
    return (
      <details data-testid="reader-toolbar" className="mb-6">
        <summary className="flex h-10 cursor-pointer list-none items-center justify-end [&::-webkit-details-marker]:hidden">
          <span className="rounded-lg border border-line px-3 py-2 text-[13px] text-ink2">
            Reading settings
          </span>
        </summary>
        <form
          action="/api/reader-prefs"
          method="get"
          className="mt-3 flex flex-col gap-4 rounded-xl border border-line bg-panel px-4 py-4"
        >
          <input type="hidden" name="return" value={returnPath} />
          <div className="flex flex-col gap-3 text-[13px]">
            <span className="font-medium text-ink2">
              Translations ({count} of {editions.length})
            </span>
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

          <DisplayField display={display} name="display" />
          <SizeField size={size} name="size" />

          <button
            type="submit"
            className="self-start rounded-lg border border-line bg-soft px-4 py-2 text-[14px] text-ink hover:border-line2"
          >
            Apply
          </button>
        </form>
      </details>
    );
  }

  // ── Enhanced (JavaScript): one control in the reader header, everything else in
  // a slide-over. The panel is portalled to <body> so a positioned ancestor in a
  // reader route can never clip it or trap it in a stacking context.
  return (
    <div
      data-testid="reader-toolbar"
      className="mb-6 flex items-center justify-end gap-3"
    >
      <span className="text-[12.5px] text-ink3">
        {count === 1
          ? (editions.find((e) => selected.has(e.id))?.translator ?? '')
          : `${count} of ${editions.length} translations`}
      </span>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-line text-ink2 hover:border-line2 hover:text-ink"
      >
        <Icon name="settings" size={18} />
        <span className="sr-only">Reading settings</span>
      </button>

      {open
        ? createPortal(
            <>
              <div
                onClick={close}
                className="fixed inset-0 z-[60] bg-black/45"
                aria-hidden="true"
              />
              <div
                ref={panelRef}
                id={panelId}
                role="dialog"
                aria-modal="true"
                aria-label="Reading settings"
                className="fixed inset-y-0 end-0 z-[70] flex h-full w-[min(400px,100vw)] flex-col border-s border-line bg-panel"
              >
                <div className="flex flex-none items-center justify-between border-b border-line px-5 py-4">
                  <h2 className="text-[15px] font-semibold text-ink">
                    Reading settings
                  </h2>
                  <button
                    type="button"
                    onClick={close}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-ink3 hover:bg-soft hover:text-ink"
                  >
                    <Icon name="close" size={18} />
                    <span className="sr-only">Close reading settings</span>
                  </button>
                </div>

                <div className="flex-1 overflow-auto px-5 py-5">
                  <section className="pb-7">
                    <div className="flex items-baseline justify-between pb-2.5">
                      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink3">
                        Translations
                      </h3>
                      <span className="text-[12px] text-ink3">
                        {count} of {editions.length} selected
                      </span>
                    </div>
                    <div className="qb-field mb-3 flex items-center gap-2.5 rounded-lg border border-line2 bg-bg px-3">
                      <span className="text-ink3" aria-hidden="true">
                        <Icon name="search" size={15} />
                      </span>
                      <input
                        type="search"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        placeholder="Filter translations"
                        aria-label="Filter translations"
                        className="w-full bg-transparent py-2.5 text-[13px] text-ink outline-none placeholder:text-ink3"
                      />
                    </div>
                    <div className="flex flex-col gap-3">
                      {[...groups.entries()].map(([language, list]) => {
                        const visible = list.filter(matches);
                        if (visible.length === 0) return null;
                        return (
                          <fieldset key={language} className="flex flex-col gap-1">
                            <legend className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink3">
                              {language}
                            </legend>
                            {visible.map((e) => {
                              const on = selected.has(e.id);
                              return (
                                <label
                                  key={e.id}
                                  className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-2.5 py-2.5 text-[13px] ${
                                    on
                                      ? 'border-accent-line bg-accent-bg'
                                      : 'border-transparent hover:bg-soft'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={on}
                                    onChange={() => toggleEdition(e.id)}
                                    className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
                                  />
                                  <span>
                                    <span className="block text-ink">
                                      {e.translator}
                                    </span>
                                    {/* ink2, not ink3: at 12px on the selected
                                        row's accent background ink3 is ~4:1 in
                                        light mode, under the 4.5:1 minimum. */}
                                    <span className="block text-[12px] text-ink2">
                                      {e.year} · {e.licence}
                                    </span>
                                  </span>
                                </label>
                              );
                            })}
                          </fieldset>
                        );
                      })}
                    </div>
                    <p className="pt-2.5 text-[12px] leading-relaxed text-ink3">
                      One translation is shown by default. Selecting more stacks
                      them under each ayah;{' '}
                      {/* Underlined always, not on hover: inside a paragraph a
                          link distinguished by colour alone fails WCAG 1.4.1. */}
                      <a
                        href="/compare"
                        className="text-accent underline underline-offset-2"
                      >
                        /compare
                      </a>{' '}
                      puts them side by side.
                    </p>
                  </section>

                  <section className="pb-7">
                    <h3 className="pb-2.5 text-[11px] font-semibold uppercase tracking-wider text-ink3">
                      Display
                    </h3>
                    <div
                      role="group"
                      aria-label="Display mode"
                      className="flex overflow-hidden rounded-lg border border-line text-[13px]"
                    >
                      {DISPLAY_MODES.map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          aria-pressed={display === mode}
                          onClick={() => chooseDisplay(mode)}
                          className={`flex-1 px-2 py-2.5 ${
                            display === mode
                              ? 'bg-accent-bg text-ink'
                              : 'text-ink2 hover:text-ink'
                          }`}
                        >
                          {DISPLAY_LABELS[mode]}
                        </button>
                      ))}
                    </div>
                  </section>

                  <section>
                    <h3 className="pb-2.5 text-[11px] font-semibold uppercase tracking-wider text-ink3">
                      Arabic size
                    </h3>
                    <div
                      role="group"
                      aria-label="Arabic size"
                      className="flex overflow-hidden rounded-lg border border-line text-[13px]"
                    >
                      {ARABIC_SIZES.map((s) => (
                        <button
                          key={s}
                          type="button"
                          aria-pressed={size === s}
                          aria-label={`Arabic size: ${SIZE_LABELS[s]}`}
                          onClick={() => chooseSize(s)}
                          className={`flex-1 px-2 py-2.5 ${
                            size === s
                              ? 'bg-accent-bg text-ink'
                              : 'text-ink2 hover:text-ink'
                          }`}
                        >
                          <span aria-hidden="true" style={{ fontSize: `${11 + s * 2}px` }}>
                            A
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                </div>

                <div className="flex flex-none items-center justify-between border-t border-line px-5 py-3.5">
                  <button
                    type="button"
                    onClick={reset}
                    className="rounded-lg px-2 py-2 text-[14px] text-ink2 hover:text-ink"
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={close}
                    className="rounded-lg bg-accent px-6 py-2.5 text-[14px] font-medium text-on-accent"
                  >
                    Done
                  </button>
                </div>
              </div>
            </>,
            document.body,
          )
        : null}
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
