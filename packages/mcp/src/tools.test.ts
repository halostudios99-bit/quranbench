import { describe, expect, it } from 'vitest';

import { ApiClient, type FetchLike } from './client.js';
import { findTool, TOOLS } from './tools.js';

// Part B acceptance: every MCP tool returns an attributable result — the corpus
// version and the query that produced it — and calls exactly the public API
// endpoint a third party would. A fake fetch stands in for the live server, so
// the wrapper is verified without depending on the web app.

function fakeClient(record: { url?: string } = {}): ApiClient {
  const fetchImpl: FetchLike = async (url) => {
    record.url = url;
    const path = url.split('/api/v1')[1] ?? url;
    const body: Record<string, unknown> = {
      corpus_version: '0.6.0',
      params: { corpusVersion: '0.6.0' },
    };
    if (path.startsWith('/search')) {
      body['total_matches'] = 42;
      body['query'] = 'root:z-k-w';
      body['query_tree'] = { type: 'root' };
    } else if (path.startsWith('/verse') || path.startsWith('/resolve')) {
      body['verses'] = [{ verse_ref: '2:255' }];
      body['reference'] = '2:255';
    } else if (path.startsWith('/token')) {
      body['token'] = { id: 'quran:tanzil-uthmani:2:255:1' };
    } else if (path.startsWith('/root')) {
      body['root'] = 'ز ك و';
      body['occurrences'] = 59;
    } else if (path.startsWith('/manifest')) {
      body['manifest'] = { corpus_version: '0.6.0' };
    }
    return {
      ok: true,
      status: 200,
      json: async () => body,
      text: async () => JSON.stringify(body),
    };
  };
  return new ApiClient({ baseUrl: 'https://quranbench.com/api/v1', fetchImpl });
}

describe('MCP tools are a thin, complete wrapper over the API', () => {
  it('exposes the six required tools', () => {
    const names = TOOLS.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        'get_manifest',
        'get_root',
        'get_token',
        'get_verse',
        'resolve_reference',
        'search_corpus',
      ].sort(),
    );
  });

  it('every tool result carries corpus version and the query (attributable)', async () => {
    const cases: Array<[string, Record<string, unknown>]> = [
      ['search_corpus', { query: 'root:z-k-w' }],
      ['get_verse', { reference: '2:255' }],
      ['get_token', { id: 'quran:tanzil-uthmani:2:255:1' }],
      ['get_root', { slug: 'z-k-w' }],
      ['resolve_reference', { reference: '2:255' }],
      ['get_manifest', {}],
    ];
    for (const [name, args] of cases) {
      const tool = findTool(name)!;
      const result = await tool.run(fakeClient(), args);
      expect(result.attribution.corpus_version).toBe('0.6.0');
      expect(result.attribution.query).toBeTruthy();
      expect(result.attribution.endpoint.startsWith('/')).toBe(true);
      expect(result.data['corpus_version']).toBe('0.6.0');
    }
  });

  it('search calls /search with the query encoded', async () => {
    const rec: { url?: string } = {};
    await findTool('search_corpus')!.run(fakeClient(rec), {
      query: 'root:z-k-w',
    });
    expect(rec.url).toContain('/api/v1/search?q=root%3Az-k-w');
  });

  it('get_token calls /token/{id} with the id encoded', async () => {
    const rec: { url?: string } = {};
    await findTool('get_token')!.run(fakeClient(rec), {
      id: 'quran:tanzil-uthmani:2:255:1',
    });
    expect(rec.url).toContain(
      '/api/v1/token/quran%3Atanzil-uthmani%3A2%3A255%3A1',
    );
  });

  it('rejects a malformed verse reference before calling the API', async () => {
    await expect(
      findTool('get_verse')!.run(fakeClient(), { reference: 'not-a-ref' }),
    ).rejects.toThrow(/not a verse reference/);
  });
});
