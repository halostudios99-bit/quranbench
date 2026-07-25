import { ApiClient, query } from './client.js';

// The six tools, each a thin call onto one public API endpoint. Every tool
// result carries the corpus version and the query that produced it, so an AI
// grounding its answer here can attribute the claim to a specific corpus
// release and a reproducible request (Prompt 11, Part B).

export interface ToolResult {
  /** A short human-readable summary line. */
  summary: string;
  /** Attribution: what makes the answer reproducible and citable. */
  attribution: { corpus_version: string; query: string; endpoint: string };
  /** The raw API response body. */
  data: Record<string, unknown>;
}

export interface ToolSpec {
  name: string;
  title: string;
  description: string;
  /** JSON-Schema-ish input description for documentation and validation. */
  input: Record<
    string,
    { type: string; description: string; required: boolean }
  >;
  run: (
    client: ApiClient,
    args: Record<string, unknown>,
  ) => Promise<ToolResult>;
}

function str(args: Record<string, unknown>, key: string): string | undefined {
  const v = args[key];
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
}

function num(args: Record<string, unknown>, key: string): number | undefined {
  const v = args[key];
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)))
    return Number(v);
  return undefined;
}

function corpusVersion(body: Record<string, unknown>): string {
  return typeof body['corpus_version'] === 'string'
    ? body['corpus_version']
    : 'unknown';
}

async function call(
  client: ApiClient,
  endpoint: string,
  queryDescription: string,
  summary: (body: Record<string, unknown>) => string,
): Promise<ToolResult> {
  const data = await client.get(endpoint);
  return {
    summary: summary(data),
    attribution: {
      corpus_version: corpusVersion(data),
      query: queryDescription,
      endpoint,
    },
    data,
  };
}

export const TOOLS: ToolSpec[] = [
  {
    name: 'search_corpus',
    title: 'Search the corpus',
    description:
      'Run a query in the quranbench query language (e.g. root:z-k-w, "الله", 2:255, prefix:al). Returns matched tokens with the parsed query, corpus version and computation parameters.',
    input: {
      query: {
        type: 'string',
        description: 'The query string.',
        required: true,
      },
      page: {
        type: 'number',
        description: 'Result page (1-based).',
        required: false,
      },
      per_page: {
        type: 'number',
        description: 'Results per page (1–500).',
        required: false,
      },
    },
    run: async (client, args) => {
      const q = str(args, 'query');
      if (!q) throw new Error('search_corpus requires a query');
      const endpoint = `/search${query({ q, page: num(args, 'page'), per_page: num(args, 'per_page') })}`;
      return call(
        client,
        endpoint,
        `search ${q}`,
        (b) => `${b['total_matches'] ?? 0} matches for "${q}"`,
      );
    },
  },
  {
    name: 'get_verse',
    title: 'Fetch a verse or range',
    description:
      'Fetch one verse or an inclusive range (e.g. 2:255 or 2:1-5) with its tokens and verse-level translations.',
    input: {
      reference: {
        type: 'string',
        description: 'A verse reference, e.g. 2:255 or 2:1-5.',
        required: true,
      },
    },
    run: async (client, args) => {
      const ref = str(args, 'reference');
      if (!ref) throw new Error('get_verse requires a reference');
      const m = /^(\d+):(\d+(?:-\d+)?)$/.exec(ref);
      if (!m)
        throw new Error(
          `'${ref}' is not a verse reference (expected s:v or s:v-w)`,
        );
      const endpoint = `/verse/${m[1]}/${m[2]}`;
      return call(client, endpoint, `verse ${ref}`, (b) => {
        const verses = Array.isArray(b['verses']) ? b['verses'].length : 0;
        return `${verses} verse${verses === 1 ? '' : 's'} for ${ref}`;
      });
    },
  },
  {
    name: 'get_token',
    title: 'Fetch a token with morphology',
    description:
      'Fetch one addressable token (word) by its identifier, with its text forms and full morphological annotation (root, lemma, part of speech, segments).',
    input: {
      id: {
        type: 'string',
        description: 'The token id, e.g. quran:tanzil-uthmani:2:255:1.',
        required: true,
      },
    },
    run: async (client, args) => {
      const id = str(args, 'id');
      if (!id) throw new Error('get_token requires an id');
      const endpoint = `/token/${encodeURIComponent(id)}`;
      return call(client, endpoint, `token ${id}`, () => `token ${id}`);
    },
  },
  {
    name: 'get_root',
    title: 'Fetch a root and its occurrences',
    description:
      'Fetch a triliteral root by its slug (e.g. z-k-w) or Arabic form, with its distribution and a page of occurrences.',
    input: {
      slug: {
        type: 'string',
        description: 'The root slug, e.g. z-k-w.',
        required: true,
      },
      page: {
        type: 'number',
        description: 'Occurrence page (1-based).',
        required: false,
      },
    },
    run: async (client, args) => {
      const slug = str(args, 'slug');
      if (!slug) throw new Error('get_root requires a slug');
      const endpoint = `/root/${encodeURIComponent(slug)}${query({ page: num(args, 'page') })}`;
      return call(
        client,
        endpoint,
        `root ${slug}`,
        (b) =>
          `root ${b['root'] ?? slug}: ${b['occurrences'] ?? 0} occurrences`,
      );
    },
  },
  {
    name: 'resolve_reference',
    title: 'Resolve a reference',
    description:
      'Resolve a verse reference (s:v or s:v-w) to its verses under the active numbering scheme.',
    input: {
      reference: {
        type: 'string',
        description: 'A verse reference, e.g. 2:43 or 2:43-45.',
        required: true,
      },
    },
    run: async (client, args) => {
      const ref = str(args, 'reference');
      if (!ref) throw new Error('resolve_reference requires a reference');
      const endpoint = `/resolve${query({ ref })}`;
      return call(
        client,
        endpoint,
        `resolve ${ref}`,
        (b) => `resolved ${b['reference'] ?? ref}`,
      );
    },
  },
  {
    name: 'get_manifest',
    title: 'Get the corpus manifest',
    description:
      'Fetch the build manifest for a corpus version (default: current): counts, sources, licences, numbering, normalisation rules and per-artifact checksums.',
    input: {
      version: {
        type: 'string',
        description: 'Corpus version, e.g. 0.6.0. Defaults to current.',
        required: false,
      },
    },
    run: async (client, args) => {
      const version = str(args, 'version');
      const endpoint = `/manifest${query({ version })}`;
      return call(
        client,
        endpoint,
        `manifest ${version ?? '(current)'}`,
        (b) => `corpus manifest v${corpusVersion(b)}`,
      );
    },
  },
];

export function findTool(name: string): ToolSpec | undefined {
  return TOOLS.find((t) => t.name === name);
}
