// @quranbench/search — an in-memory index and query engine over a loaded Corpus.
// Pure functions: no DB, no network, no Next.js. Layer 2 of the architecture.
// Build the index once at boot, then evaluate queries against it.

export { buildIndex, type SearchIndex } from './build-index.js';
export { search, searchString } from './search.js';
export { evaluate } from './evaluate.js';
export { parseQuery } from './parse.js';
export { parseReference, resolveReference, type ParsedReference } from './reference.js';
export { normaliseArabic, canonicaliseUthmani } from './normalise.js';

export type {
  Query,
  ExactQuery,
  NormalisedQuery,
  PrefixQuery,
  SuffixQuery,
  PatternQuery,
  ProximityQuery,
  AdjacencyQuery,
  AndQuery,
  OrQuery,
  NotQuery,
  ScopedQuery,
  MatchAllQuery,
  ReferenceQuery,
  RootQuery,
  LemmaQuery,
  PosQuery,
  Scope,
  SearchResult,
  ParseError,
  ParseResult,
} from './types.js';
export { UnsupportedQueryError } from './types.js';

// Computation parameters (Part C, Prompt 03): no statistic without the
// parameters that produced it.
export type { ComputationParams, NormalisationProfile } from './params.js';
export { DEFAULT_PARAMS, withDefaults, serialiseParams, parseParams } from './params.js';
