// The corpus port the domain layer sees. It exposes exactly what the rules need
// from the in-memory corpus and search index — run a query, resolve a pinned
// token, project a token to its citation keys — and nothing more. The real
// implementation (src/server/corpus-gateway.ts) wraps the search index; tests
// supply a fake. This is the seam that keeps `packages/search` free of any
// database and keeps the domain rules free of the whole corpus.

import type { CitationKind } from './types';

export interface QueryRunResult {
  ok: boolean;
  /** Number of matched tokens when ok; 0 and a message when not. */
  count: number;
  error?: string;
}

export interface ResolvedToken {
  /** The requested id, or its successor if the corpus mapped it forward. */
  tokenId: string;
  resolved: boolean;
}

/** A citation target derived from a pinned token: the token, its root, its
 *  segment (verse) and its surah. Written to the citation projection on publish. */
export interface CitationTarget {
  kind: CitationKind;
  key: string;
}

export interface CorpusGateway {
  /** The version of the corpus currently loaded in memory. */
  readonly version: string;
  /** Parse and execute a query string against the in-memory index. */
  runQuery(query: string): QueryRunResult;
  /** Resolve a pinned token id against the loaded corpus, or report it unresolved. */
  resolveToken(tokenId: string): ResolvedToken;
  /** The citation keys a pinned token contributes to (token, root, segment, surah). */
  citationTargets(tokenId: string): CitationTarget[];
}
