import 'server-only';

import { SITE_URL } from '@/lib/site';
import { getCorpus } from '@/server/corpus';
import { currentVersion } from '@/server/artifacts';
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
  type ApiResult,
} from './core';

// The OpenAPI document is generated from the implementation, never hand-written
// (docs/extensibility.md §5). For each endpoint we invoke the real handler on a
// known-good input and derive the 200 response schema from the actual body it
// returns. A test regenerates this and asserts the documented shape still equals
// the live response, so the schema cannot silently drift from the code.

interface Param {
  name: string;
  in: 'path' | 'query';
  required: boolean;
  description: string;
  schema: Record<string, unknown>;
}

interface EndpointSpec {
  path: string;
  summary: string;
  description: string;
  parameters: Param[];
  /** Invoke the real handler with a representative valid input. */
  sample: () => ApiResult;
}

/** Representative valid inputs, drawn from the loaded corpus so they never 404. */
function specs(): EndpointSpec[] {
  const corpus = getCorpus();
  const sampleTokenId = corpus.tokens[0]!.id;
  const sampleRootSlug = corpus.roots[0]!.root_slug;

  return [
    {
      path: '/api/v1',
      summary: 'API index',
      description: 'Description of the API and its read endpoints.',
      parameters: [],
      sample: rootIndexResponse,
    },
    {
      path: '/api/v1/versions',
      summary: 'List corpus versions',
      description: 'Every published corpus version resolvable through the API.',
      parameters: [],
      sample: versionsResponse,
    },
    {
      path: '/api/v1/manifest',
      summary: 'Corpus manifest',
      description:
        'The immutable build manifest for a corpus version: counts, sources, licences, numbering, normalisation rules and per-artifact checksums.',
      parameters: [
        {
          name: 'version',
          in: 'query',
          required: false,
          description:
            'Corpus version, e.g. 0.6.0. Defaults to the current version.',
          schema: { type: 'string' },
        },
      ],
      sample: () => manifestResponse(),
    },
    {
      path: '/api/v1/surah/{number}',
      summary: 'Surah with verses',
      description:
        'Surah metadata and its verse list under the active numbering scheme.',
      parameters: [
        {
          name: 'number',
          in: 'path',
          required: true,
          description: 'Surah number, 1–114.',
          schema: { type: 'integer', minimum: 1, maximum: 114 },
        },
      ],
      sample: () => surahResponse(1),
    },
    {
      path: '/api/v1/verse/{surah}/{ordinal}',
      summary: 'Verse or verse range',
      description:
        'One verse or an inclusive range (e.g. 2/255 or 2/1-5) with its tokens and verse-level translations.',
      parameters: [
        {
          name: 'surah',
          in: 'path',
          required: true,
          description: 'Surah number, 1–114.',
          schema: { type: 'integer', minimum: 1, maximum: 114 },
        },
        {
          name: 'ordinal',
          in: 'path',
          required: true,
          description: 'Verse ordinal or inclusive range, e.g. 255 or 1-5.',
          schema: { type: 'string', pattern: '^\\d+(-\\d+)?$' },
        },
      ],
      sample: () => verseResponse(1, 1, 1),
    },
    {
      path: '/api/v1/token/{id}',
      summary: 'Token with morphology',
      description:
        'One addressable token, its text forms and full morphological annotation.',
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          description:
            'Opaque token identifier, e.g. quran:tanzil-uthmani:2:43:4.',
          schema: { type: 'string' },
        },
      ],
      sample: () => tokenResponse(sampleTokenId),
    },
    {
      path: '/api/v1/root/{slug}',
      summary: 'Root and occurrences',
      description:
        'A triliteral root, its distribution, and one page of its occurrences.',
      parameters: [
        {
          name: 'slug',
          in: 'path',
          required: true,
          description: 'Root transliteration slug, e.g. z-k-w.',
          schema: { type: 'string' },
        },
        {
          name: 'page',
          in: 'query',
          required: false,
          description: 'Occurrence page (1-based).',
          schema: { type: 'integer', minimum: 1 },
        },
      ],
      sample: () => rootResponse(sampleRootSlug, 1, 50),
    },
    {
      path: '/api/v1/search',
      summary: 'Search the corpus',
      description:
        'Run a query in the corpus query language and page over matched tokens. The response carries the parsed query tree, corpus version and computation parameters.',
      parameters: [
        {
          name: 'q',
          in: 'query',
          required: true,
          description:
            'Query string, e.g. "root:z-k-w" or a reference like 2:43.',
          schema: { type: 'string' },
        },
        {
          name: 'page',
          in: 'query',
          required: false,
          description: 'Result page (1-based).',
          schema: { type: 'integer', minimum: 1 },
        },
        {
          name: 'per_page',
          in: 'query',
          required: false,
          description: 'Results per page (1–500, default 50).',
          schema: { type: 'integer', minimum: 1, maximum: 500 },
        },
        {
          name: 'basmala',
          in: 'query',
          required: false,
          description: 'Include separated basmala tokens (0 or 1).',
          schema: { type: 'string', enum: ['0', '1'] },
        },
      ],
      sample: () => searchResponse('1:1'),
    },
    {
      path: '/api/v1/resolve',
      summary: 'Resolve a reference',
      description:
        'Resolve a verse reference (s:v or s:v-w) to its verses under the active scheme.',
      parameters: [
        {
          name: 'ref',
          in: 'query',
          required: true,
          description: 'Verse reference, e.g. 2:43 or 2:43-45.',
          schema: { type: 'string' },
        },
      ],
      sample: () => resolveResponse('1:1'),
    },
  ];
}

function schemaOf(value: unknown): Record<string, unknown> {
  if (value === null) return { nullable: true };
  if (Array.isArray(value)) {
    return { type: 'array', items: value.length ? schemaOf(value[0]) : {} };
  }
  switch (typeof value) {
    case 'string':
      return { type: 'string' };
    case 'number':
      return { type: Number.isInteger(value) ? 'integer' : 'number' };
    case 'boolean':
      return { type: 'boolean' };
    case 'object':
      return { type: 'object' };
    default:
      return {};
  }
}

/** Derive an object schema from an actual response body — its real properties. */
function responseSchema(
  body: Record<string, unknown>,
): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const [key, value] of Object.entries(body)) {
    properties[key] = schemaOf(value);
    required.push(key);
  }
  return { type: 'object', properties, required };
}

/** Build the OpenAPI 3.1 document by introspecting live responses. */
export function buildOpenApi(): Record<string, unknown> {
  const paths: Record<string, unknown> = {};
  for (const spec of specs()) {
    const result = spec.sample();
    paths[spec.path] = {
      get: {
        summary: spec.summary,
        description: spec.description,
        parameters: spec.parameters,
        responses: {
          [String(result.status)]: {
            description: 'Success. Carries corpus_version and params.',
            content: {
              'application/json': { schema: responseSchema(result.body) },
            },
          },
        },
      },
    };
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'quranbench public API',
      version: currentVersion(),
      description:
        'Open, keyless, read-only access to the quranbench corpus. Every response carries the corpus version and the computation parameters that produced it. No key required; generous published rate limits.',
      license: {
        name: 'See /data for per-artifact licences',
        url: `${SITE_URL}/data`,
      },
    },
    servers: [{ url: SITE_URL }],
    paths,
  };
}

/** The endpoint paths documented in the schema — used by the drift test. */
export function documentedEndpoints(): {
  path: string;
  sample: () => ApiResult;
}[] {
  return specs().map((s) => ({ path: s.path, sample: s.sample }));
}
