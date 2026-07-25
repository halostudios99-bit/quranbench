import type { ComputationParams } from './params.js';

// The typed query tree. A query string parses to one of these; the engine
// evaluates them against an index. Adding root/lemma later (see RootQuery /
// LemmaQuery) does not change SearchResult — that is the extension point the
// spec requires.

/** Restrict a query to surahs and/or an inclusive verse-ordinal range. */
export interface Scope {
  surahs?: number[];
  /** Inclusive range of verse ordinals within a single surah. */
  segmentRange?: { surah: number; from: number; to: number };
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

// --- Morphology queries (Prompt 06). --------------------------------------
/**
 * Match every token sharing a root. `root` accepts the spaced-Arabic form
 * (`ز ك و`), the unspaced form (`زكو`), or the URL transliteration slug
 * (`z-k-w`) — all resolve to the same postings.
 */
export interface RootQuery {
  type: 'root';
  root: string;
}
/** Match every token sharing a lemma (dictionary form). */
export interface LemmaQuery {
  type: 'lemma';
  lemma: string;
}
/** Match every token whose head part-of-speech is `pos` (e.g. `V`, `PN`, `N`). */
export interface PosQuery {
  type: 'pos';
  pos: string;
}

export type Query =
  | ExactQuery
  | NormalisedQuery
  | PrefixQuery
  | SuffixQuery
  | PatternQuery
  | ProximityQuery
  | AdjacencyQuery
  | AndQuery
  | OrQuery
  | NotQuery
  | ScopedQuery
  | MatchAllQuery
  | ReferenceQuery
  | RootQuery
  | LemmaQuery
  | PosQuery;

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

export type ParseResult =
  | { ok: true; query: Query }
  | { ok: false; error: ParseError };

/**
 * Reserved for query types that are declared in the tree but not yet evaluable.
 * As of v0.5.0 every query type — including root, lemma and pos — is implemented,
 * so the engine never throws this; it is kept as a stable extension point.
 */
export class UnsupportedQueryError extends Error {
  constructor(type: string) {
    super(`query type '${type}' is not implemented`);
    this.name = 'UnsupportedQueryError';
  }
}
