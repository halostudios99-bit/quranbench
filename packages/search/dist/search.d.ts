import type { SearchIndex } from './build-index.js';
import { type ComputationParams } from './params.js';
import type { ParseError, Query, SearchResult } from './types.js';
/**
 * Run a typed query against the index. `params` overrides defaults; the result's
 * `corpusVersion` is always pinned to the loaded corpus, never the caller's word.
 */
export declare function search(index: SearchIndex, query: Query, params?: Partial<ComputationParams>): SearchResult;
/**
 * Parse `input` and run it. Returns the search result or a typed parse error —
 * never throws for a malformed query.
 */
export declare function searchString(index: SearchIndex, input: string, params?: Partial<ComputationParams>): {
    ok: true;
    result: SearchResult;
} | {
    ok: false;
    error: ParseError;
};
