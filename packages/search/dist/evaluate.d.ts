import type { SearchIndex } from './build-index.js';
import { type Query } from './types.js';
/** Evaluate a query to the set of matching token handles. */
export declare function evaluate(index: SearchIndex, query: Query): Set<number>;
