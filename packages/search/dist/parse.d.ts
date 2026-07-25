import type { ParseResult } from './types.js';
/** Parse a query string into a typed tree. Returns a typed error, never throws. */
export declare function parseQuery(input: string): ParseResult;
