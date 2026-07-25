// Reader preferences, as pure data. No I/O and no 'server-only' marker: this
// module is shared by the server pref reader (reads the cookies), the client
// reader toolbar (writes them), and the no-JS route handler (parses a submitted
// form). Keeping the cookie names, defaults and parsing in one place means the
// three surfaces can never disagree on what a stored value means.
//
// Three independent preferences drive the reading experience:
//   - which translation editions are shown (multi-select)
//   - the display mode: Arabic only / Arabic + translation / translation only
//   - the Arabic text size (three steps, applied via a CSS custom property)
// None gate any content: every edition is rendered server-side and complete
// without JavaScript; these only choose what a given reader sees.

export const TRANSLATION_COOKIE = 'qb_translations';
export const DISPLAY_COOKIE = 'qb_reader_display';
export const SIZE_COOKIE = 'qb_reader_size';

export type DisplayMode = 'arabic' | 'both' | 'translation';
export type ArabicSize = 1 | 2 | 3;

export const DISPLAY_MODES: DisplayMode[] = ['arabic', 'both', 'translation'];
export const ARABIC_SIZES: ArabicSize[] = [1, 2, 3];

export const DEFAULT_DISPLAY: DisplayMode = 'both';
export const DEFAULT_SIZE: ArabicSize = 2;

/** Human label for a display mode, for controls and screen readers. */
export const DISPLAY_LABELS: Record<DisplayMode, string> = {
  arabic: 'Arabic only',
  both: 'Arabic + translation',
  translation: 'Translation only',
};

/** Human label for an Arabic size step. */
export const SIZE_LABELS: Record<ArabicSize, string> = {
  1: 'Small',
  2: 'Medium',
  3: 'Large',
};

/**
 * The Arabic size multiplier applied to the reader as the `--qb-arabic-scale`
 * custom property. The middle step is 1 (the design-system reading size); the
 * outer steps stay within the design system's 28–34px reading range for the base
 * 30px reader glyph.
 */
export function arabicScale(size: ArabicSize): number {
  return size === 1 ? 0.9 : size === 3 ? 1.13 : 1;
}

export function parseDisplay(raw: string | undefined | null): DisplayMode {
  return raw === 'arabic' || raw === 'translation' ? raw : DEFAULT_DISPLAY;
}

export function parseSize(raw: string | undefined | null): ArabicSize {
  return raw === '1' ? 1 : raw === '3' ? 3 : DEFAULT_SIZE;
}

/**
 * Resolve the reader's selected edition ids from the cookie value, intersected
 * with what is actually available. `undefined` means "show all" (the default and
 * the `all` sentinel); `[]` means the reader hid every edition. Selection order
 * follows the available (manifest) order so the reading order is stable.
 */
export function parseEditions(
  raw: string | undefined | null,
  available: string[],
): string[] | undefined {
  if (!raw || raw === 'all') return undefined;
  if (raw === 'none') return [];
  const chosen = new Set(raw.split(',').filter(Boolean));
  return available.filter((id) => chosen.has(id));
}

/**
 * Serialise a selected-edition set to a cookie value. `all`/`none` are sentinels
 * so a newly-added edition defaults to shown (a reader who never touched the
 * setting keeps seeing every edition, including later additions).
 */
export function serialiseEditions(selected: Set<string>, all: string[]): string {
  if (selected.size >= all.length) return 'all';
  if (selected.size === 0) return 'none';
  return all.filter((id) => selected.has(id)).join(',');
}

export interface ReaderPrefs {
  /** Selected edition ids, or undefined for "all" (the default). */
  editions: string[] | undefined;
  display: DisplayMode;
  size: ArabicSize;
}

export const DEFAULT_READER_PREFS: ReaderPrefs = {
  editions: undefined,
  display: DEFAULT_DISPLAY,
  size: DEFAULT_SIZE,
};

/** Normalise an untrusted stored/JSON prefs object (e.g. from the profile). */
export function normaliseReaderPrefs(
  value: unknown,
  available: string[],
): ReaderPrefs {
  if (typeof value !== 'object' || value === null) return DEFAULT_READER_PREFS;
  const v = value as Record<string, unknown>;
  const editionsRaw = v['editions'];
  let editions: string[] | undefined;
  if (Array.isArray(editionsRaw)) {
    const set = new Set(editionsRaw.filter((x): x is string => typeof x === 'string'));
    editions = available.filter((id) => set.has(id));
  } else {
    editions = undefined;
  }
  return {
    editions,
    display: parseDisplay(typeof v['display'] === 'string' ? (v['display'] as string) : undefined),
    size: parseSize(typeof v['size'] === 'number' ? String(v['size']) : (v['size'] as string)),
  };
}
