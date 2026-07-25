// Canonical URLs and identifiers for every addressable unit (architecture doc
// §"Addressable units"). One place builds these so links never drift.

export function surahHref(surah: number): string {
  return `/${surah}`;
}

export function verseHref(surah: number, ordinal: number): string {
  return `/${surah}/${ordinal}`;
}

export function rangeHref(surah: number, from: number, to: number): string {
  return from === to ? verseHref(surah, from) : `/${surah}/${from}-${to}`;
}

/** Word (token) page. The id stays human-readable; only URL-unsafe bytes encode. */
export function wordHref(tokenId: string): string {
  return `/word/${encodeURIComponent(tokenId)}`;
}

/** Root page, canonical transliteration slug (`z-k-w`). */
export function rootHref(slug: string): string {
  return `/root/${slug}`;
}

/** A page of a root's occurrence list. Page 1 is the bare root page. */
export function rootOccurrencesHref(slug: string, page: number): string {
  return page <= 1 ? rootHref(slug) : `/root/${slug}/page/${page}`;
}

/** A page of a long surah. Page 1 is the bare surah page (its canonical). */
export function surahPageHref(surah: number, page: number): string {
  return page <= 1 ? surahHref(surah) : `/${surah}/page/${page}`;
}

/** The continuous, single-document view of a whole surah (noindex). */
export function surahAllHref(surah: number): string {
  return `/${surah}/all`;
}

/** A token's short reference, e.g. `2:43:4` (surah:verse:index), or basmala. */
export function tokenRefLabel(
  surah: number,
  ordinal: number | null,
  position: number,
): string {
  return ordinal === null
    ? `${surah}:basmala:${position}`
    : `${surah}:${ordinal}:${position}`;
}

export function surahId(surah: number): string {
  return `quran:${surah}`;
}

export function verseId(surah: number, ordinal: number): string {
  return `quran:${surah}:${ordinal}`;
}

export function rangeId(surah: number, from: number, to: number): string {
  return from === to ? verseId(surah, from) : `quran:${surah}:${from}-${to}`;
}

/** A short human reference like `2:43` or `2:43-45`. */
export function referenceLabel(
  surah: number,
  from: number,
  to: number,
): string {
  return from === to ? `${surah}:${from}` : `${surah}:${from}-${to}`;
}

const AYAH_RE = /^(\d+)(?:-(\d+))?$/;

/** Parse the `[ayah]` route segment into a from/to ordinal range, or null. */
export function parseAyahParam(
  param: string,
): { from: number; to: number } | null {
  const m = AYAH_RE.exec(param);
  if (!m) return null;
  const from = Number(m[1]);
  const to = m[2] === undefined ? from : Number(m[2]);
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from)
    return null;
  return { from, to };
}

/** Parse the `[surah]` route segment (1–114), or null. */
export function parseSurahParam(param: string): number | null {
  if (!/^\d+$/.test(param)) return null;
  const n = Number(param);
  return n >= 1 && n <= 114 ? n : null;
}
