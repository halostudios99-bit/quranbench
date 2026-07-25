import type { SearchIndex } from './build-index.js';
import { evaluateHandles } from './evaluate.js';
import { withDefaults, type ComputationParams } from './params.js';
import { parseQuery } from './parse.js';
import type { ParseError, Query, SearchResult } from './types.js';

// Materialise a query into a SearchResult. The result carries the corpus version
// and the exact ComputationParams, so it is sufficient on its own to reproduce
// the query — the product's core promise, expressed as a return type.

/**
 * Run a typed query against the index. `params` overrides defaults; the result's
 * `corpusVersion` is always pinned to the loaded corpus, never the caller's word.
 */
export function search(
  index: SearchIndex,
  query: Query,
  params: Partial<ComputationParams> = {},
): SearchResult {
  const resolved: ComputationParams = { ...withDefaults(params), corpusVersion: index.version };

  // evaluateHandles returns handles already sorted ascending and unique, so the
  // basmala filter below preserves order and no sort is needed here.
  const handles = evaluateHandles(index, query);

  const ordered: number[] = resolved.includeBasmala
    ? handles
    : handles.filter((h) => !index.isBasmala[h]);

  const tokenIds: string[] = new Array(ordered.length);
  const segmentIds: string[] = [];
  // Tokens are in corpus order and every segment is a contiguous handle block,
  // so distinct segments appear as adjacent runs in the sorted result: a run
  // break is a new segment. This avoids a per-token Set over ~19k matches.
  let lastSegment = '';
  for (let i = 0; i < ordered.length; i++) {
    const token = index.tokens[ordered[i]!]!;
    tokenIds[i] = token.id;
    if (token.segment_id !== lastSegment) {
      segmentIds.push(token.segment_id);
      lastSegment = token.segment_id;
    }
  }

  return {
    query,
    tokenIds,
    segmentIds,
    totalMatches: tokenIds.length,
    corpusVersion: index.version,
    params: resolved,
  };
}

/**
 * Parse `input` and run it. Returns the search result or a typed parse error —
 * never throws for a malformed query.
 */
export function searchString(
  index: SearchIndex,
  input: string,
  params: Partial<ComputationParams> = {},
): { ok: true; result: SearchResult } | { ok: false; error: ParseError } {
  const parsed = parseQuery(input);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  return { ok: true, result: search(index, parsed.query, params) };
}
