import type { ComputationParams } from './params.js';
/** Restrict a query to surahs and/or an inclusive verse-ordinal range. */
export interface Scope {
    surahs?: number[];
    /** Inclusive range of verse ordinals within a single surah. */
    segmentRange?: {
        surah: number;
        from: number;
        to: number;
    };
}
/** Match `text_uthmani` under Unicode canonical equivalence. */
export interface ExactQuery {
    type: 'exact';
    text: string;
}
/** Match `text_normalised` (diacritic- and orthography-insensitive). */
export interface NormalisedQuery {
    type: 'normalised';
    text: string;
}
/** Normalised form starts with / ends with `text`. */
export interface PrefixQuery {
    type: 'prefix';
    text: string;
}
export interface SuffixQuery {
    type: 'suffix';
    text: string;
}
/** Wildcard over normalised forms: `*` any sequence, `?` one character. */
export interface PatternQuery {
    type: 'pattern';
    pattern: string;
}
/** `left NEAR/distance right`: both within `distance` tokens. */
export interface ProximityQuery {
    type: 'proximity';
    left: Query;
    right: Query;
    distance: number;
    /** Allow the pair to span a segment boundary. Defaults to false. */
    crossSegment?: boolean;
}
/** `left FOLLOWED_BY right`: `right` immediately follows `left`, same segment. */
export interface AdjacencyQuery {
    type: 'adjacency';
    left: Query;
    right: Query;
}
export interface AndQuery {
    type: 'and';
    clauses: Query[];
}
export interface OrQuery {
    type: 'or';
    clauses: Query[];
}
export interface NotQuery {
    type: 'not';
    clause: Query;
}
/** Restrict `query` to `scope`. */
export interface ScopedQuery {
    type: 'scoped';
    scope: Scope;
    query: Query;
}
/** Everything in scope. Used as the inner query of a bare `surah:` scope. */
export interface MatchAllQuery {
    type: 'all';
}
/** Resolve a verse reference to segments under the active numbering scheme. */
export interface ReferenceQuery {
    type: 'reference';
    ref: string;
}
export interface RootQuery {
    type: 'root';
    root: string;
}
export interface LemmaQuery {
    type: 'lemma';
    lemma: string;
}
export type Query = ExactQuery | NormalisedQuery | PrefixQuery | SuffixQuery | PatternQuery | ProximityQuery | AdjacencyQuery | AndQuery | OrQuery | NotQuery | ScopedQuery | MatchAllQuery | ReferenceQuery | RootQuery | LemmaQuery;
/**
 * A search result. It carries everything needed to reproduce the query: the
 * query tree, the corpus version, and the exact computation parameters. A number
 * without the parameters that produced it is not citable — that promise is
 * expressed here as a type.
 */
export interface SearchResult {
    query: Query;
    /** Matched token ids, in corpus (document) order. */
    tokenIds: string[];
    /** Distinct segment ids the matches fall in, in corpus order. */
    segmentIds: string[];
    totalMatches: number;
    corpusVersion: string;
    params: ComputationParams;
}
/** A parse failure with the character offset at which it was detected. */
export interface ParseError {
    message: string;
    position: number;
}
export type ParseResult = {
    ok: true;
    query: Query;
} | {
    ok: false;
    error: ParseError;
};
/** Thrown by the engine for query types that are declared but not implemented. */
export declare class UnsupportedQueryError extends Error {
    constructor(type: string);
}
