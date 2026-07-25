import type { Segment } from '@quranbench/corpus';
import type { SearchIndex } from './build-index.js';
export interface ParsedReference {
    surah: number;
    from: number;
    to: number;
}
/** Parse reference *syntax* only. Returns null if the string is not a reference. */
export declare function parseReference(ref: string): ParsedReference | null;
/**
 * Resolve a reference to its segments under the index's active numbering scheme.
 * Returns the segments that exist; an out-of-range ordinal (e.g. `2:0`) yields an
 * empty list rather than an error. Returns null only if `ref` is not a reference.
 */
export declare function resolveReference(index: SearchIndex, ref: string): Segment[] | null;
