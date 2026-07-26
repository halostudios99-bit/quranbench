import { describe, expect, it } from 'vitest';

import {
  arabicScale,
  DEFAULT_DISPLAY,
  DEFAULT_EDITION_ID,
  DEFAULT_SIZE,
  defaultEditions,
  normaliseReaderPrefs,
  parseDisplay,
  parseEditions,
  parseSize,
  serialiseEditions,
} from '@/lib/reader-prefs';

// The reader preferences are pure data shared by the server reader, the client
// toolbar and the no-JS route handler. These assert the three surfaces can never
// disagree on what a stored value means — and that an unknown value falls back to
// a safe default rather than hiding content.

const AVAILABLE = ['en-itani', 'en-pickthall', 'en-rodwell', 'en-palmer'];

describe('defaultEditions', () => {
  it('is the named default edition when it exists', () => {
    expect(defaultEditions(AVAILABLE)).toEqual([DEFAULT_EDITION_ID]);
  });

  it('never defaults to a display-only edition', () => {
    // Itani is first in manifest order but is CC BY-NC-ND; ordering must not be
    // what decides the default.
    expect(defaultEditions(AVAILABLE)).not.toContain('en-itani');
  });

  it('falls back to the first available edition when the default is absent', () => {
    expect(defaultEditions(['en-rodwell', 'en-palmer'])).toEqual(['en-rodwell']);
    expect(defaultEditions([])).toEqual([]);
  });
});

describe('parseEditions', () => {
  it('treats a missing cookie as "the default single edition", not "all"', () => {
    // A reader who has never opened the panel sees one translation.
    expect(parseEditions(undefined, AVAILABLE)).toEqual([DEFAULT_EDITION_ID]);
    expect(parseEditions('', AVAILABLE)).toEqual([DEFAULT_EDITION_ID]);
  });

  it('treats the "all" sentinel as an explicit "show all"', () => {
    // Distinct from a missing cookie: this reader ticked everything, and that
    // choice must survive the default changing.
    expect(parseEditions('all', AVAILABLE)).toBeUndefined();
  });

  it('treats "none" as an explicit empty selection', () => {
    expect(parseEditions('none', AVAILABLE)).toEqual([]);
  });

  it('intersects the stored ids with what is available, in available order', () => {
    expect(parseEditions('en-rodwell,en-itani', AVAILABLE)).toEqual([
      'en-itani',
      'en-rodwell',
    ]);
    // Unknown ids are dropped, never fabricated.
    expect(parseEditions('en-rodwell,en-nope', AVAILABLE)).toEqual(['en-rodwell']);
  });
});

describe('serialiseEditions round-trips through parseEditions', () => {
  it('a full selection serialises to the "all" sentinel', () => {
    const value = serialiseEditions(new Set(AVAILABLE), AVAILABLE);
    expect(value).toBe('all');
    expect(parseEditions(value, AVAILABLE)).toBeUndefined();
  });

  it('an empty selection serialises to "none"', () => {
    expect(serialiseEditions(new Set(), AVAILABLE)).toBe('none');
  });

  it('a partial selection round-trips to the same ordered subset', () => {
    const chosen = new Set(['en-palmer', 'en-itani']);
    const value = serialiseEditions(chosen, AVAILABLE);
    expect(parseEditions(value, AVAILABLE)).toEqual(['en-itani', 'en-palmer']);
  });
});

describe('parseDisplay / parseSize', () => {
  it('accepts the known values and falls back to the default otherwise', () => {
    expect(parseDisplay('arabic')).toBe('arabic');
    expect(parseDisplay('translation')).toBe('translation');
    expect(parseDisplay('both')).toBe('both');
    expect(parseDisplay('nonsense')).toBe(DEFAULT_DISPLAY);
    expect(parseDisplay(undefined)).toBe(DEFAULT_DISPLAY);

    expect(parseSize('1')).toBe(1);
    expect(parseSize('3')).toBe(3);
    expect(parseSize('2')).toBe(2);
    expect(parseSize('9')).toBe(DEFAULT_SIZE);
    expect(parseSize(null)).toBe(DEFAULT_SIZE);
  });
});

describe('arabicScale never breaks the 24px floor', () => {
  it('is 1 at the middle step and stays within the design range', () => {
    expect(arabicScale(2)).toBe(1);
    // The reader's base glyph is 30px; the smallest step must not fall below 24px.
    expect(30 * arabicScale(1)).toBeGreaterThanOrEqual(24);
    expect(arabicScale(3)).toBeGreaterThan(1);
  });
});

describe('normaliseReaderPrefs sanitises untrusted stored JSON', () => {
  it('drops unknown editions and clamps unknown modes/sizes', () => {
    const prefs = normaliseReaderPrefs(
      { editions: ['en-itani', 'en-bogus'], display: 'weird', size: 7 },
      AVAILABLE,
    );
    expect(prefs.editions).toEqual(['en-itani']);
    expect(prefs.display).toBe(DEFAULT_DISPLAY);
    expect(prefs.size).toBe(DEFAULT_SIZE);
  });

  it('returns the defaults for a non-object', () => {
    expect(normaliseReaderPrefs(null, AVAILABLE).editions).toEqual([
      DEFAULT_EDITION_ID,
    ]);
    expect(normaliseReaderPrefs('x', AVAILABLE).display).toBe(DEFAULT_DISPLAY);
  });

  it('treats a stored record with no editions array as "never chosen"', () => {
    // Profiles written before the reader had a per-edition setting.
    expect(normaliseReaderPrefs({ display: 'both' }, AVAILABLE).editions).toEqual([
      DEFAULT_EDITION_ID,
    ]);
  });

  it('keeps an explicitly stored full selection', () => {
    // Both writers store the resolved array, so "every edition" is preserved
    // rather than being mistaken for an absent value.
    expect(normaliseReaderPrefs({ editions: AVAILABLE }, AVAILABLE).editions).toEqual(
      AVAILABLE,
    );
  });
});
