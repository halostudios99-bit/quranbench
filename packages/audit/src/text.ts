// Pure text utilities. No corpus, no I/O. These parse the *article* strings;
// Arabic normalisation that must match the corpus lives in @quranbench/search
// and is never reimplemented here.

/** Arabic script letters, marks and punctuation (block + supplements + presentation forms). */
const ARABIC =
  '\\u0600-\\u06FF\\u0750-\\u077F\\u08A0-\\u08FF\\uFB50-\\uFDFF\\uFE70-\\uFEFF';

const ARABIC_CHAR = new RegExp(`[${ARABIC}]`);
// Base Arabic *letters* only — excludes tashkeel/marks, Arabic-Indic digits and
// ornaments like the verse-number brackets ﴿ ﴾, so those never count as words.
const ARABIC_LETTER = /[ء-يٮ-ۓۺ-ۼﭐ-ﯿ]/;
// A run of Arabic characters, allowing internal whitespace/joiners between words.
const ARABIC_RUN = new RegExp(`[${ARABIC}][${ARABIC}\\s\\u200c\\u200d]*`, 'g');

export interface Span {
  text: string;
  index: number;
}

export function hasArabic(s: string): boolean {
  return ARABIC_CHAR.test(s);
}

export function hasArabicLetter(s: string): boolean {
  return ARABIC_LETTER.test(s);
}

/** Maximal runs of Arabic text, trimmed, with their start offsets. */
export function arabicRuns(text: string): Span[] {
  const out: Span[] = [];
  for (const m of text.matchAll(ARABIC_RUN)) {
    const raw = m[0];
    const trimmed = raw.replace(/[\s‌‍]+$/u, '');
    if (!hasArabic(trimmed)) continue;
    out.push({ text: trimmed, index: m.index });
  }
  return out;
}

export function firstArabicRun(text: string): string | null {
  return arabicRuns(text)[0]?.text ?? null;
}

/** The last Arabic run that ends within `window` chars before `offset`. */
export function arabicRunBefore(
  text: string,
  offset: number,
  window: number,
): string | null {
  const start = Math.max(0, offset - window);
  const runs = arabicRuns(text.slice(start, offset));
  return runs.length ? (runs[runs.length - 1]?.text ?? null) : null;
}

/** Split an Arabic run into words, keeping only words with an Arabic letter. */
export function arabicWords(run: string): string[] {
  return run
    .split(/[\s‌‍]+/u)
    .map((w) => w.trim())
    .filter((w) => hasArabicLetter(w));
}

/** Map char offsets to 1-based line numbers. */
export function lineIndexer(text: string): (offset: number) => number {
  const starts: number[] = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') starts.push(i + 1);
  }
  return (offset: number) => {
    // binary search for the greatest line start <= offset
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid]! <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
}

/** A short single-line excerpt of the source around `offset`. */
export function excerptAt(text: string, offset: number, span = 90): string {
  const lineStart = text.lastIndexOf('\n', offset) + 1;
  let lineEnd = text.indexOf('\n', offset);
  if (lineEnd === -1) lineEnd = text.length;
  const line = text.slice(lineStart, lineEnd).trim();
  if (line.length <= span) return line;
  const rel = offset - lineStart;
  const from = Math.max(0, rel - span / 2);
  return (from > 0 ? '…' : '') + line.slice(from, from + span).trim() + '…';
}

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n]!;
}

/** 0..1 similarity based on edit distance. */
export function similarity(a: string, b: string): number {
  if (a.length === 0 && b.length === 0) return 1;
  const dist = levenshtein(a, b);
  return 1 - dist / Math.max(a.length, b.length);
}

// --- Coarse consonant skeletons, used only for gross transliteration checks ---

const ARABIC_CONSONANT: Record<string, string> = {
  ب: 'b',
  ت: 't',
  ث: 't',
  ج: 'j',
  ح: 'h',
  خ: 'k',
  د: 'd',
  ذ: 'd',
  ر: 'r',
  ز: 'z',
  س: 's',
  ش: 's',
  ص: 's',
  ض: 'd',
  ط: 't',
  ظ: 'z',
  غ: 'g',
  ف: 'f',
  ق: 'k',
  ك: 'k',
  ل: 'l',
  م: 'm',
  ن: 'n',
  ه: 'h',
  ة: 'h',
  و: 'w',
  ي: 'y',
  // carriers, hamza forms and vowels intentionally omitted (ا أ إ آ ء ئ ؤ ى ع)
};

/** Coarse consonant class multiset of an Arabic word (diacritics ignored). */
export function arabicConsonants(word: string): string[] {
  const out: string[] = [];
  for (const ch of word) {
    const c = ARABIC_CONSONANT[ch];
    if (c) out.push(c);
  }
  return out;
}

/** Coarse consonant class multiset of a Latin transliteration. */
export function translitConsonants(input: string): string[] {
  let s = input.toLowerCase().replace(/[^a-z]/g, '');
  s = s
    .replace(/sh/g, 's')
    .replace(/th/g, 't')
    .replace(/kh/g, 'k')
    .replace(/gh/g, 'g')
    .replace(/dh/g, 'd');
  const map: Record<string, string> = {
    b: 'b',
    t: 't',
    j: 'j',
    h: 'h',
    d: 'd',
    r: 'r',
    z: 'z',
    s: 's',
    f: 'f',
    q: 'k',
    k: 'k',
    l: 'l',
    m: 'm',
    n: 'n',
    w: 'w',
    y: 'y',
    g: 'g',
  };
  const out: string[] = [];
  for (const ch of s) {
    const c = map[ch];
    if (c) out.push(c);
  }
  return out;
}

/** Multiset overlap ratio in [0,1] of two consonant class lists. */
export function consonantOverlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const pool = [...b];
  let hits = 0;
  for (const c of a) {
    const i = pool.indexOf(c);
    if (i !== -1) {
      hits++;
      pool.splice(i, 1);
    }
  }
  return hits / Math.max(a.length, b.length);
}
