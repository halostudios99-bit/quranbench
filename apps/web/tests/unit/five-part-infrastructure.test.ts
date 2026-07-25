import { describe, expect, it } from 'vitest';

import { ApiClient, type FetchLike } from '@quranbench/mcp/client';
import { findTool } from '@quranbench/mcp/tools';

import {
  manifestResponse,
  resolveResponse,
  rootResponse,
  searchResponse,
  tokenResponse,
  verseResponse,
  type ApiResult,
} from '@/server/api/core';
import { RATE_LIMIT_PER_MINUTE } from '@/server/api/http';
import { licenceGroups } from '@/server/api/downloads';
import {
  currentVersion,
  listArtifacts,
  resolveArtifact,
} from '@/server/artifacts';
import { getCorpus } from '@/server/corpus';

// docs/extensibility.md §9 — the test of whether this is infrastructure. Each of
// the five properties is exercised end to end. Part 5 drives the real MCP tools
// through an adapter that routes their HTTP calls to the live API handlers, so
// the AI-grounding path is exercised for real rather than mocked.

/** Route an MCP client's HTTP request to the in-process API handlers. */
const adapterFetch: FetchLike = async (url) => {
  const u = new URL(url);
  const path = u.pathname.replace(/^.*\/api\/v1/, '') || '/';
  const p = u.searchParams;
  let result: ApiResult;

  if (path.startsWith('/search')) {
    result = searchResponse(p.get('q') ?? '', {
      page: Number(p.get('page') ?? '1') || 1,
      perPage: Number(p.get('per_page') ?? '50') || 50,
    });
  } else if (path.startsWith('/verse/')) {
    const [, , surah, ayah] = path.split('/');
    const [from, to] = (ayah ?? '').split('-');
    result = verseResponse(Number(surah), Number(from), Number(to ?? from));
  } else if (path.startsWith('/token/')) {
    result = tokenResponse(decodeURIComponent(path.slice('/token/'.length)));
  } else if (path.startsWith('/root/')) {
    result = rootResponse(
      decodeURIComponent(path.slice('/root/'.length)),
      Number(p.get('page') ?? '1') || 1,
    );
  } else if (path.startsWith('/resolve')) {
    result = resolveResponse(p.get('ref') ?? '');
  } else if (path.startsWith('/manifest')) {
    result = manifestResponse(p.get('version') ?? undefined);
  } else {
    result = { status: 404, body: { error: 'not_found' } };
  }

  return {
    ok: result.status < 400,
    status: result.status,
    json: async () => result.body,
    text: async () => JSON.stringify(result.body),
  };
};

function mcpClient(): ApiClient {
  return new ApiClient({
    baseUrl: 'https://quranbench.com/api/v1',
    fetchImpl: adapterFetch,
  });
}

describe('§9 — a stranger can treat this as infrastructure', () => {
  const version = currentVersion();

  it('Part 1 — cite a specific word in a specific version with a stable URL', () => {
    const corpus = getCorpus();
    const token = corpus.tokens[1234]!;
    const res = tokenResponse(token.id);
    expect(res.status).toBe(200);
    const dto = res.body['token'] as { id: string; url: string };
    // The URL is a pure function of the opaque id — stable across releases.
    expect(dto.id).toBe(token.id);
    expect(dto.url).toBe(
      `https://quranbench.com/word/${encodeURIComponent(token.id)}`,
    );
    expect(res.body['corpus_version']).toBe(version);
  });

  it('Part 2 — download the whole dataset under a redistribution licence', () => {
    const groups = licenceGroups(version);
    const grouped = new Set(groups.flatMap((g) => g.files.map((f) => f.path)));
    const all = new Set(listArtifacts(version).map((a) => a.path));
    // Nothing is undownloadable and nothing is unlicensed.
    expect(grouped).toEqual(all);
    for (const group of groups) {
      expect(group.licence).toBeTruthy();
      for (const file of group.files) {
        expect(resolveArtifact(version, file.path)).not.toBeNull();
      }
    }
    // The licences present all permit redistribution.
    const licences = groups.map((g) => g.licence);
    expect(licences.some((l) => /CC-BY/.test(l))).toBe(true);
    expect(licences.some((l) => /GPL/.test(l))).toBe(true);
  });

  it('Part 3 — rebuild a published statistic and get the same number', () => {
    const root = getCorpus().roots[0]!;
    const fromRecord = root.occurrences;
    const fromApi = rootResponse(root.root_slug).body['occurrences'];
    // Independently recompute via the search engine's root query.
    const fromSearch = searchResponse(`root:${root.root_slug}`).body[
      'total_matches'
    ];
    expect(fromApi).toBe(fromRecord);
    expect(fromSearch).toBe(fromRecord);
  });

  it('Part 4 — query the API without registering, under a published limit', () => {
    // The handlers take no credential of any kind; a query just works.
    const res = searchResponse('1:1');
    expect(res.status).toBe(200);
    expect(res.body['total_matches']).toBeGreaterThan(0);
    // The rate limit is published and generous.
    expect(RATE_LIMIT_PER_MINUTE).toBeGreaterThanOrEqual(300);
  });

  it('Part 5 — point an AI (MCP) at it and get grounded, attributable answers', async () => {
    const client = mcpClient();
    const root = getCorpus().roots[0]!;
    const cases: Array<[string, Record<string, unknown>]> = [
      ['search_corpus', { query: `root:${root.root_slug}` }],
      ['get_verse', { reference: '2:255' }],
      ['get_root', { slug: root.root_slug }],
      ['resolve_reference', { reference: '2:255' }],
      ['get_manifest', {}],
    ];
    for (const [name, args] of cases) {
      const result = await findTool(name)!.run(client, args);
      // Every answer an AI receives is attributable to a version and a query.
      expect(result.attribution.corpus_version).toBe(version);
      expect(result.attribution.query).toBeTruthy();
      expect(result.data['corpus_version']).toBe(version);
    }
  });
});
