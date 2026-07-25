// Extraction: turn article markdown into raw, unverified claims. Pure string
// work — verification against the corpus happens in verify.ts.

import {
  arabicRuns,
  arabicRunBefore,
  firstArabicRun,
  hasArabic,
  type Span,
} from './text.js';

export interface RawReference {
  raw: string;
  surahName: string | null;
  surah: number;
  fromVerse: number;
  toVerse: number;
  index: number;
  /** Char offset just past the matched reference. */
  end: number;
  /** A third number was present (e.g. `8:82:820`) — signals a hadith citation. */
  triple: boolean;
  /** Arabic quote paired with this reference (the verse text quoted beside it). */
  arabic: string | null;
  arabicIndex: number | null;
}

export interface RawArabicQuote {
  text: string;
  index: number;
}

export interface RawRootClaim {
  raw: string;
  targetTerm: string;
  targetArabic: string | null;
  claimedRoot: string;
  index: number;
}

export interface RawTransliteration {
  translit: string;
  arabic: string;
  index: number;
}

export interface Extraction {
  references: RawReference[];
  /** Arabic quotes not paired with any reference. */
  looseArabic: RawArabicQuote[];
  rootClaims: RawRootClaim[];
  transliterations: RawTransliteration[];
}

// "Quran Al-Bakarah 2:43", "Quran 92:18", "Al-Isra 17:95", "6:38", "2:43-45",
// and hadith-style triples like "8:82:820". The surah name never spans a line
// break (only spaces/tabs) so a heading is not swallowed into the name.
const REFERENCE =
  /(?:\b(?:Quran|Qur'an|Surah|Sura|Chapter)[ \t]+)?([A-Z][A-Za-z'’]+(?:-[A-Za-z'’]+)?(?:[ \t]+[A-Z][A-Za-z'’]+)?[ \t]+)?(\d{1,3}):(\d{1,3})(?:[-–](\d{1,3}))?(?::(\d{1,4}))?/g;

// "root word for zakat is …", "Root word for Salat (صلاة) is Tasil (تصل)"
const ROOT_CLAIM = /root\s+word\s+(?:for|of)\s+([\s\S]{0,60}?)\s+is\s+([\s\S]{0,80})/gi;

function extractReferences(text: string): RawReference[] {
  const refs: RawReference[] = [];
  for (const m of text.matchAll(REFERENCE)) {
    const surah = Number(m[2]);
    const fromVerse = Number(m[3]);
    const toVerse = m[4] ? Number(m[4]) : fromVerse;
    refs.push({
      raw: m[0].trim(),
      surahName: m[1] ? m[1].trim() : null,
      surah,
      fromVerse,
      toVerse,
      index: m.index,
      end: m.index + m[0].length,
      triple: m[5] !== undefined,
      arabic: null,
      arabicIndex: null,
    });
  }
  return refs;
}

interface Marker {
  kind: 'ref' | 'arabic';
  index: number;
  ref?: RawReference;
  span?: Span;
}

/**
 * Pair each Arabic quote with the reference it cites. Articles use two layouts —
 * a `[box]` block and a bare `Quran N:M` line — but both share one signal: a
 * cited verse follows its reference with *nothing but whitespace between them*
 * (the reference ends a line, then the Arabic). So an Arabic run is paired with
 * a preceding reference only when no Latin letter separates them. Arabic sitting
 * inside a sentence (a parenthetical gloss, a one-word aside) always has prose
 * between it and any reference, so it stays loose; an inline reference in prose
 * gets no quote and is only resolved.
 */
const MAX_PAIR_GAP = 400;

function pairArabic(
  text: string,
  refs: RawReference[],
  arabic: Span[],
): { references: RawReference[]; looseArabic: RawArabicQuote[] } {
  const markers: Marker[] = [
    ...refs.map((ref): Marker => ({ kind: 'ref', index: ref.index, ref })),
    ...arabic.map((span): Marker => ({ kind: 'arabic', index: span.index, span })),
  ].sort((a, b) => a.index - b.index);

  const loose: RawArabicQuote[] = [];
  let pending: RawReference | null = null;
  for (const marker of markers) {
    if (marker.kind === 'ref') {
      pending = marker.ref!;
    } else {
      const span = marker.span!;
      const gap = pending ? text.slice(pending.end, span.index) : '';
      const clean = pending !== null && span.index - pending.end < MAX_PAIR_GAP && !/[A-Za-z]/.test(gap);
      if (clean) {
        pending!.arabic = span.text;
        pending!.arabicIndex = span.index;
        pending = null;
      } else {
        loose.push({ text: span.text, index: span.index });
        // A reference followed by prose is an inline mention, not a quote header.
        if (pending && /[A-Za-z]/.test(gap)) pending = null;
      }
    }
  }
  return { references: refs, looseArabic: loose };
}

function extractRootClaims(text: string): RawRootClaim[] {
  const claims: RawRootClaim[] = [];
  for (const m of text.matchAll(ROOT_CLAIM)) {
    const targetTerm = m[1]!.trim();
    const remainder = m[2]!;
    const claimedRoot = firstArabicRun(remainder);
    if (!claimedRoot) continue;
    const targetArabic =
      firstArabicRun(targetTerm) ?? arabicRunBefore(text, m.index, 90);
    claims.push({
      raw: m[0].trim().replace(/\s+/g, ' '),
      targetTerm,
      targetArabic,
      claimedRoot,
      index: m.index,
    });
  }
  return claims;
}

const STOPWORDS = new Set([
  'the',
  'and',
  'is',
  'a',
  'of',
  'to',
  'in',
  'for',
  'word',
  'quran',
  'allah',
  'as',
  'or',
  'means',
  'meaning',
]);

const PAREN_AFTER = /\(([^)]{1,40})\)/;

function extractTransliterations(text: string): RawTransliteration[] {
  const out: RawTransliteration[] = [];
  const seen = new Set<string>();
  const push = (translit: string, arabic: string, index: number) => {
    const t = translit.trim();
    const a = arabic.trim();
    // A transliteration pairs a single Latin word with a single Arabic word.
    // Multi-word gloss like "Massive Loan" or a whole quoted phrase is a
    // translation, not a transliteration, and is not checked here.
    if (/\s/.test(t) || /\s/.test(a)) return;
    const key = `${index}:${a}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ translit: t, arabic: a, index });
  };

  // Deliberate author pairings: "Salat (صلاة)", "Baraka (بَارَكًا)".
  const latinThenParen = /\b([A-Z][A-Za-z'’]{1,20})\s*\(([^)]{1,40})\)/g;
  for (const m of text.matchAll(latinThenParen)) {
    const inner = firstArabicRun(m[2]!);
    if (inner) push(m[1]!, inner, m.index);
  }
  // "Arabic (Translit)": e.g. "صلاة (Salat)" or "الصَّلَاةَ (akeemu)"
  for (const span of arabicRuns(text)) {
    const rest = text.slice(span.index + span.text.length, span.index + span.text.length + 44);
    const pm = rest.match(PAREN_AFTER);
    if (pm && /[A-Za-z]/.test(pm[1]!) && !hasArabic(pm[1]!)) {
      push(pm[1]!, span.text, span.index);
    }
  }
  // Adjacent "Translit Arabic": e.g. "Rafa رَّفَعَهُ", "Daraja دَرَجَا".
  const latinThenArabic = new RegExp(
    `\\b([A-Z][A-Za-z'’]{1,20})\\s+([\\u0600-\\u06FF\\u0750-\\u077F\\uFB50-\\uFDFF\\uFE70-\\uFEFF]+)`,
    'g',
  );
  for (const m of text.matchAll(latinThenArabic)) {
    if (STOPWORDS.has(m[1]!.toLowerCase())) continue;
    push(m[1]!, m[2]!, m.index);
  }
  return out;
}

export function extract(text: string): Extraction {
  const refs = extractReferences(text);
  const arabic = arabicRuns(text);
  const { references, looseArabic } = pairArabic(text, refs, arabic);
  return {
    references,
    looseArabic,
    rootClaims: extractRootClaims(text),
    transliterations: extractTransliterations(text),
  };
}
