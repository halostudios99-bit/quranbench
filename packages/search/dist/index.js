// @quranbench/search — an in-memory index and query engine over a loaded Corpus.
// Pure functions: no DB, no network, no Next.js. Layer 2 of the architecture.
// Build the index once at boot, then evaluate queries against it.
export { buildIndex } from './build-index.js';
export { search, searchString } from './search.js';
export { evaluate } from './evaluate.js';
export { parseQuery } from './parse.js';
export { parseReference, resolveReference } from './reference.js';
export { normaliseArabic, canonicaliseUthmani } from './normalise.js';
export { UnsupportedQueryError } from './types.js';
export { DEFAULT_PARAMS, withDefaults, serialiseParams, parseParams } from './params.js';
//# sourceMappingURL=index.js.map