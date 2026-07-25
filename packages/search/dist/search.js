import { evaluate } from './evaluate.js';
import { withDefaults } from './params.js';
import { parseQuery } from './parse.js';
// Materialise a query into a SearchResult. The result carries the corpus version
// and the exact ComputationParams, so it is sufficient on its own to reproduce
// the query — the product's core promise, expressed as a return type.
/**
 * Run a typed query against the index. `params` overrides defaults; the result's
 * `corpusVersion` is always pinned to the loaded corpus, never the caller's word.
 */
export function search(index, query, params = {}) {
    const resolved = { ...withDefaults(params), corpusVersion: index.version };
    const handles = evaluate(index, query);
    const ordered = [];
    for (const h of handles) {
        if (!resolved.includeBasmala && index.isBasmala[h])
            continue;
        ordered.push(h);
    }
    ordered.sort((a, b) => a - b);
    const tokenIds = new Array(ordered.length);
    const segmentIds = [];
    const seenSegments = new Set();
    for (let i = 0; i < ordered.length; i++) {
        const token = index.tokens[ordered[i]];
        tokenIds[i] = token.id;
        if (!seenSegments.has(token.segment_id)) {
            seenSegments.add(token.segment_id);
            segmentIds.push(token.segment_id);
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
export function searchString(index, input, params = {}) {
    const parsed = parseQuery(input);
    if (!parsed.ok)
        return { ok: false, error: parsed.error };
    return { ok: true, result: search(index, parsed.query, params) };
}
//# sourceMappingURL=search.js.map