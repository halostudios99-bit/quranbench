import { describe, expect, it } from 'vitest';

import {
  arabicScale,
  DEFAULT_DISPLAY,
  DEFAULT_SIZE,
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

describe('parseEditions', () => {
  it('treats a missing cookie and the "all" sentinel as "show all"', () => {
    expect(parseEditions(undefined, AVAILABLE)).toBeUndefined();
    expect(parseEditions('', AVAILABLE)).toBeUndefined();
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
    expect(normaliseReaderPrefs(null, AVAILABLE).editions).toBeUndefined();
    expect(normaliseReaderPrefs('x', AVAILABLE).display).toBe(DEFAULT_DISPLAY);
  });
});
