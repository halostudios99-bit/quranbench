import type { Corpus, Segment, Token } from '@quranbench/corpus';
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
/** Build the search index from a loaded corpus. Pure: reads only the corpus. */
export declare function buildIndex(corpus: Corpus): SearchIndex;
