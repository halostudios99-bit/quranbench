import { describe, expect, it } from 'vitest';

import {
  CONTINUOUS_MAX_VERSES,
  isPaginatedSurah,
  pageCount,
  pageSlice,
  parsePageParam,
  surahPageCount,
  VERSES_PER_PAGE,
} from '@/lib/pagination';

// The pagination policy is pure, so it is tested with no server and no corpus.

describe('surah pagination policy', () => {
  it('reads short surahs continuously (single page)', () => {
    expect(isPaginatedSurah(7)).toBe(false);
    expect(isPaginatedSurah(CONTINUOUS_MAX_VERSES)).toBe(false);
    expect(surahPageCount(7)).toBe(1);
    expect(surahPageCount(CONTINUOUS_MAX_VERSES)).toBe(1);
  });

  it('paginates long surahs in fixed 40-verse blocks', () => {
    expect(isPaginatedSurah(CONTINUOUS_MAX_VERSES + 1)).toBe(true);
    // Al-Baqara: 286 verses → ceil(286 / 40) = 8 pages.
    expect(surahPageCount(286)).toBe(8);
    expect(VERSES_PER_PAGE).toBe(40);
  });

  it('slices the ordered verse list per page', () => {
    expect(pageSlice(1, VERSES_PER_PAGE)).toEqual({ start: 0, end: 40 });
    expect(pageSlice(3, VERSES_PER_PAGE)).toEqual({ start: 80, end: 120 });
    expect(pageSlice(8, VERSES_PER_PAGE)).toEqual({ start: 280, end: 320 });
  });

  it('counts pages of any list, at least one', () => {
    expect(pageCount(0, 20)).toBe(1);
    expect(pageCount(59, 20)).toBe(3);
    expect(pageCount(40, 20)).toBe(2);
  });

  it('parses only page numbers ≥ 2 (page 1 is the canonical bare route)', () => {
    expect(parsePageParam('2')).toBe(2);
    expect(parsePageParam('8')).toBe(8);
    expect(parsePageParam('1')).toBeNull();
    expect(parsePageParam('0')).toBeNull();
    expect(parsePageParam('-3')).toBeNull();
    expect(parsePageParam('all')).toBeNull();
    expect(parsePageParam('2.5')).toBeNull();
  });
});
