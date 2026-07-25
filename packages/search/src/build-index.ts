import type { Corpus, Segment, Token } from '@quranbench/corpus';

import { canonicaliseUthmani } from './normalise.js';

// The in-memory search index. Built once from a loaded Corpus at process boot.
// Internally a token is a small integer — its position in the corpus document
// order — so postings are number[] and set algebra is cheap. Ids are recovered
// only when a result is materialised. The corpus is tiny (~77k tokens, a few
// MB), so plain typed arrays and Maps beat any cleverness here.

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
  /** segment id → handles (in document order). */
  segmentTokens: Map<string, number[]>;
  /** verse segment id → segment record (basmala segments are absent). */
  segmentById: Map<string, Segment>;
  /** surah number → handles (in document order). */
  surahTokens: Map<number, number[]>;
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
  const segmentTokens = new Map<string, number[]>();
  const surahTokens = new Map<number, number[]>();
  const segmentOrder = new Map<string, number>();

  for (let i = 0; i < n; i++) {
    const t = tokens[i]!;
    segmentIdOf[i] = t.segment_id;
    isBasmala[i] = t.is_basmala;
    byId.set(t.id, i);

    push(exact, canonicaliseUthmani(t.text_uthmani), i);
    push(normalised, t.text_normalised, i);
    push(segmentTokens, t.segment_id, i);

    if (!segmentOrder.has(t.segment_id)) segmentOrder.set(t.segment_id, segmentOrder.size);

    const surahList = surahTokens.get(t.surah);
    if (surahList) surahList.push(i);
    else surahTokens.set(t.surah, [i]);
  }

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
    segmentTokens,
    segmentById,
    surahTokens,
    segmentOrder,
    activeScheme,
    refIndex,
  };
}
