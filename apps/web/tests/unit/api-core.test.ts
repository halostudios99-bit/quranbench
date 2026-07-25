import { describe, expect, it } from 'vitest';

import {
  manifestResponse,
  resolveResponse,
  rootIndexResponse,
  rootResponse,
  searchResponse,
  surahResponse,
  tokenResponse,
  verseResponse,
  versionsResponse,
} from '@/server/api/core';
import { buildOpenApi, documentedEndpoints } from '@/server/api/openapi';
import { getCorpus } from '@/server/corpus';

// Part A acceptance: every read endpoint carries the corpus version and the
// computation parameters that produced it, and the OpenAPI schema is generated
// from — and matches — the real responses.

function sampleIds() {
  const corpus = getCorpus();
  return {
    tokenId: corpus.tokens[0]!.id,
    rootSlug: corpus.roots[0]!.root_slug,
    version: corpus.version,
  };
}

describe('every API endpoint carries corpus version and params', () => {
  it('all read endpoints include corpus_version and params', () => {
    const { tokenId, rootSlug } = sampleIds();
    const responses = [
      rootIndexResponse(),
      versionsResponse(),
      manifestResponse(),
      surahResponse(1),
      verseResponse(2, 255, 255),
      tokenResponse(tokenId),
      rootResponse(rootSlug, 1, 10),
      searchResponse('1:1'),
      resolveResponse('2:255'),
    ];
    for (const r of responses) {
      expect(r.status).toBe(200);
      expect(typeof r.body['corpus_version']).toBe('string');
      expect(r.body['params']).toBeTruthy();
      expect(
        typeof (r.body['params'] as { corpusVersion: string }).corpusVersion,
      ).toBe('string');
      expect(r.body['params_serialised']).toContain('corpus=');
    }
  });

  it('search echoes the query and parsed tree', () => {
    const r = searchResponse('root:' + sampleIds().rootSlug);
    expect(r.status).toBe(200);
    expect(r.body['query']).toContain('root:');
    expect(r.body['query_tree']).toBeTruthy();
    expect(typeof r.body['total_matches']).toBe('number');
    expect(r.body['total_matches']).toBeGreaterThan(0);
  });

  it('resolve returns the referenced verse', () => {
    const r = resolveResponse('2:255');
    const verses = r.body['verses'] as Array<{ verse_ref: string }>;
    expect(verses[0]!.verse_ref).toBe('2:255');
  });

  it('unknown ids 404 but still carry corpus version', () => {
    const r = tokenResponse('quran:tanzil-uthmani:999:999:999');
    expect(r.status).toBe(404);
    expect(typeof r.body['corpus_version']).toBe('string');
  });
});

describe('OpenAPI schema is generated from and matches the implementation', () => {
  it('documents every endpoint with a valid 3.1 envelope', () => {
    const doc = buildOpenApi();
    expect(doc['openapi']).toBe('3.1.0');
    const paths = doc['paths'] as Record<string, unknown>;
    expect(Object.keys(paths).length).toBeGreaterThanOrEqual(9);
    expect(paths['/api/v1/search']).toBeTruthy();
    expect(paths['/api/v1/token/{id}']).toBeTruthy();
  });

  it('documented response properties equal the live response keys', () => {
    const doc = buildOpenApi() as {
      paths: Record<
        string,
        {
          get: {
            responses: Record<
              string,
              {
                content: {
                  'application/json': { schema: { required: string[] } };
                };
              }
            >;
          };
        }
      >;
    };
    for (const { path, sample } of documentedEndpoints()) {
      const live = sample();
      const responses = doc.paths[path]!.get.responses;
      const status = Object.keys(responses)[0]!;
      const required =
        responses[status]!.content['application/json'].schema.required;
      expect(new Set(required)).toEqual(new Set(Object.keys(live.body)));
    }
  });
});
