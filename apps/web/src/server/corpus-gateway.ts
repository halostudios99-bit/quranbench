import 'server-only';

import type {
  CitationTarget,
  CorpusGateway,
  QueryRunResult,
  ResolvedToken,
} from './domain/corpus-gateway';
import { getCorpus, getIndex, getToken } from './corpus';
import { searchString } from '@quranbench/search';

// The production CorpusGateway. It wraps the in-memory search index and corpus
// (a per-process singleton) so the domain layer can run the publish-gate query
// and resolve pins without importing the corpus or the search engine directly.
// This keeps `packages/search` free of the application and the database.

export const corpusGateway: CorpusGateway = {
  get version(): string {
    return getCorpus().version;
  },

  runQuery(query: string): QueryRunResult {
    const outcome = searchString(getIndex(), query);
    if (!outcome.ok)
      return { ok: false, count: 0, error: outcome.error.message };
    return { ok: true, count: outcome.result.totalMatches };
  },

  resolveToken(tokenId: string): ResolvedToken {
    const token = getToken(tokenId);
    return { tokenId, resolved: token !== undefined };
  },

  citationTargets(tokenId: string): CitationTarget[] {
    const token = getToken(tokenId);
    if (!token) return [{ kind: 'TOKEN', key: tokenId }];
    const targets: CitationTarget[] = [
      { kind: 'TOKEN', key: token.id },
      { kind: 'SEGMENT', key: token.segment_id },
      { kind: 'SURAH', key: String(token.surah) },
    ];
    if (token.morphology.root_slug)
      targets.push({ kind: 'ROOT', key: token.morphology.root_slug });
    return targets;
  },
};
