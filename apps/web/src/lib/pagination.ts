// Pagination policy, expressed as pure functions (design-system §6, "Long-surah
// pagination"). A short surah reads continuously; a long one paginates by real
// routing so every page is server-rendered, crawlable and canonical to itself.
// The corpus carries no ruku metadata, so the ruku option degrades to fixed
// blocks — recorded here as the single source of the page-size decision.

/** Surahs at or below this verse count read continuously by default. */
export const CONTINUOUS_MAX_VERSES = 60;

/** A paginated surah shows this many verses per page (the ruku fallback block). */
export const VERSES_PER_PAGE = 40;

/** Occurrences per page on a root's full occurrence list. */
export const ROOT_OCCURRENCES_PER_PAGE = 20;

export function isPaginatedSurah(verseCount: number): boolean {
  return verseCount > CONTINUOUS_MAX_VERSES;
}

/** Number of pages for a value split into fixed blocks (at least 1). */
export function pageCount(total: number, perPage: number): number {
  return Math.max(1, Math.ceil(total / perPage));
}

/** Number of reader pages a surah occupies. Continuous surahs are a single page. */
export function surahPageCount(verseCount: number): number {
  return isPaginatedSurah(verseCount)
    ? pageCount(verseCount, VERSES_PER_PAGE)
    : 1;
}

/** Half-open slice `[start, end)` into an ordered list for a 1-based page. */
export function pageSlice(
  page: number,
  perPage: number,
): { start: number; end: number } {
  const start = (page - 1) * perPage;
  return { start, end: start + perPage };
}

/** Parse a `/page/[n]` segment: a whole number ≥ 2, else null (page 1 is canonical). */
export function parsePageParam(param: string): number | null {
  if (!/^\d+$/.test(param)) return null;
  const n = Number(param);
  return n >= 2 ? n : null;
}
