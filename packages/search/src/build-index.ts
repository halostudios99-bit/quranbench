import type { Corpus, Segment, Token } from '@quranbench/corpus';

import { canonicaliseUthmani, normaliseArabic } from './normalise.js';

// The in-memory search index. Built once from a loaded Corpus at process boot.
// Internally a token is a small integer — its position in the corpus document
// order — so postings are number[] and set algebra is cheap. Ids are recovered
// only when a result is materialised. The corpus is tiny (~77k tokens, a few
// MB), so plain typed arrays and Maps beat any cleverness here.

/**
 * A half-open handle interval `[start, end)`. Because tokens are stored in
 * corpus order, every surah and every segment occupies one contiguous block of
 * handles, so a scope resolves to a range check rather than a membership scan.
 */
export interface HandleRange {
  start: number;
  end: number;
}

export interface SearchIndex {
  corpus: Corpus;
  version: string;
  /** Tokens in corpus document order; the index into this array is the handle. */
  tokens: Token[];
  /** segmentIdOf[i] — segment id of token i. */
  segmentIdOf: string[];
  /** isBasmala[i] — whether token i is part of a separated basmala. */
  isBasmala: boolean[];
  /** token id → handle. */
  byId: Map<string, number>;
  /** canonical Uthmani form → handles. */
  exact: Map<string, number[]>;
  /** normalised form → handles. */
  normalised: Map<string, number[]>;
  /** spaced-Arabic root (`ز ك و`) → handles. */
  root: Map<string, number[]>;
  /** root slug (`z-k-w`) → spaced-Arabic root, from roots.json. */
  rootBySlug: Map<string, string>;
  /** exact lemma → handles. */
  lemma: Map<string, number[]>;
  /** normalised lemma → handles (diacritic-insensitive lemma lookup). */
  lemmaNormalised: Map<string, number[]>;
  /** head part-of-speech → handles. */
  pos: Map<string, number[]>;
  /** segment id → handles (in document order). */
  segmentTokens: Map<string, number[]>;
  /** verse segment id → segment record (basmala segments are absent). */
  segmentById: Map<string, Segment>;
  /** surah number → handles (in document order). */
  surahTokens: Map<number, number[]>;
  /** surah number → contiguous handle range. Scope resolution is a range check. */
  surahRange: Map<number, HandleRange>;
  /** segment id → contiguous handle range. Segment-scope resolution is a range check. */
  segmentRange: Map<string, HandleRange>;
  /** segment id → first-appearance ordinal, for stable result ordering. */
  segmentOrder: Map<string, number>;
  /** Active numbering scheme id (manifest.numbering.active). */
  activeScheme: string;
  /** surah → (verse ordinal under the active scheme → segment). */
  refIndex: Map<number, Map<number, Segment>>;
}

function push(map: Map<string, number[]>, key: string, value: number): void {
  const existing = map.get(key);
  if (existing) existing.push(value);
  else map.set(key, [value]);
}

/** Build the search index from a loaded corpus. Pure: reads only the corpus. */
export function buildIndex(corpus: Corpus): SearchIndex {
  const tokens = corpus.tokens;
  const n = tokens.length;

  const segmentIdOf: string[] = new Array(n);
  const isBasmala: boolean[] = new Array(n);
  const byId = new Map<string, number>();
  const exact = new Map<string, number[]>();
  const normalised = new Map<string, number[]>();
  const root = new Map<string, number[]>();
  const lemma = new Map<string, number[]>();
  const lemmaNormalised = new Map<string, number[]>();
  const pos = new Map<string, number[]>();
  const segmentTokens = new Map<string, number[]>();
  const surahTokens = new Map<number, number[]>();
  const surahRange = new Map<number, HandleRange>();
  const segmentRange = new Map<string, HandleRange>();
  const segmentOrder = new Map<string, number>();

  for (let i = 0; i < n; i++) {
    const t = tokens[i]!;
    segmentIdOf[i] = t.segment_id;
    isBasmala[i] = t.is_basmala;
    byId.set(t.id, i);

    push(exact, canonicaliseUthmani(t.text_uthmani), i);
    push(normalised, t.text_normalised, i);
    push(segmentTokens, t.segment_id, i);

    // Morphology indices, built in the same pass. A token's head root/lemma/pos
    // come from its morphology block (the head stem); clitics have no root.
    const m = t.morphology;
    if (m.root) push(root, m.root, i);
    if (m.lemma) {
      push(lemma, m.lemma, i);
      push(lemmaNormalised, normaliseArabic(m.lemma), i);
    }
    push(pos, m.pos, i);

    if (!segmentOrder.has(t.segment_id)) segmentOrder.set(t.segment_id, segmentOrder.size);

    const surahList = surahTokens.get(t.surah);
    if (surahList) surahList.push(i);
    else surahTokens.set(t.surah, [i]);

    // Tokens are in corpus order, so a surah's (and a segment's) handles are a
    // contiguous block; widening the end as we go yields its half-open range.
    const sr = surahRange.get(t.surah);
    if (sr) sr.end = i + 1;
    else surahRange.set(t.surah, { start: i, end: i + 1 });

    const segr = segmentRange.get(t.segment_id);
    if (segr) segr.end = i + 1;
    else segmentRange.set(t.segment_id, { start: i, end: i + 1 });
  }

  // The slug→root map comes from roots.json, where the build emitted the
  // authoritative transliteration. Search never re-derives a slug, so the two
  // languages cannot drift.
  const rootBySlug = new Map<string, string>();
  for (const r of corpus.roots) rootBySlug.set(r.root_slug, r.root);

  const activeScheme = corpus.manifest.numbering.active;
  const refIndex = new Map<number, Map<number, Segment>>();
  const segmentById = new Map<string, Segment>();
  for (const segment of corpus.segments) {
    segmentById.set(segment.id, segment);
    const ordinal = segment.ordinals[activeScheme];
    if (ordinal === undefined) continue;
    let bySurah = refIndex.get(segment.surah);
    if (!bySurah) {
      bySurah = new Map<number, Segment>();
      refIndex.set(segment.surah, bySurah);
    }
    bySurah.set(ordinal, segment);
  }

  return {
    corpus,
    version: corpus.version,
    tokens,
    segmentIdOf,
    isBasmala,
    byId,
    exact,
    normalised,
    root,
    rootBySlug,
    lemma,
    lemmaNormalised,
    pos,
    segmentTokens,
    segmentById,
    surahTokens,
    surahRange,
    segmentRange,
    segmentOrder,
    activeScheme,
    refIndex,
  };
}
