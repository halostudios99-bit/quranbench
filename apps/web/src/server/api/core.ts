import 'server-only';

import type { Root, Segment, Token } from '@quranbench/corpus';
import {
  DEFAULT_PARAMS,
  searchString,
  serialiseParams,
  type ComputationParams,
} from '@quranbench/search';

import { rootHref, verseHref, wordHref } from '@/lib/addressing';
import { absoluteUrl } from '@/lib/site';
import {
  describeRoot,
  findRootByArabic,
  getActiveScheme,
  getCorpus,
  getIndex,
  getRootBySlug,
  getRootOccurrences,
  getSurah,
  getSurahVerses,
  getTextEdition,
  getToken,
  getVerse,
  getVerseRange,
  getVerseTranslations,
  listSurahs,
  type VerseView,
} from '@/server/corpus';
import {
  currentVersion,
  isKnownVersion,
  listVersions,
  readManifest,
} from '@/server/artifacts';

// The public API contract, as pure functions over the in-memory corpus. The
// route handlers under app/api/v1 are thin adapters onto these; the content
// negotiation layer reuses the same builders. There is deliberately no response
// shape here that a page can reach but the API cannot — one surface, one
// contract (docs/extensibility.md §5).

export interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

/** The computation parameters in force for the live corpus. */
export function currentParams(): ComputationParams {
  return {
    ...DEFAULT_PARAMS,
    corpusVersion: getCorpus().version,
    numberingScheme: getActiveScheme(),
    textEdition: DEFAULT_PARAMS.textEdition,
  };
}

// Every response carries the corpus version and the exact computation
// parameters that produced it — a number without its parameters is not citable.
function meta(extra: Record<string, unknown> = {}): Record<string, unknown> {
  const params = currentParams();
  return {
    corpus_version: params.corpusVersion,
    text_edition: getTextEdition(),
    numbering_scheme: params.numberingScheme,
    params,
    params_serialised: serialiseParams(params),
    ...extra,
  };
}

function notFound(message: string): ApiResult {
  return { status: 404, body: { error: 'not_found', message, ...meta() } };
}

function badRequest(message: string): ApiResult {
  return { status: 400, body: { error: 'bad_request', message, ...meta() } };
}

// ─── DTOs ────────────────────────────────────────────────────────────────────

function verseRefLabel(surah: number, ordinal: number | null): string {
  return ordinal === null ? `${surah}:basmala` : `${surah}:${ordinal}`;
}

function tokenDto(
  token: Token,
  ordinal: number | null,
): Record<string, unknown> {
  return {
    id: token.id,
    segment_id: token.segment_id,
    surah: token.surah,
    verse_ref: verseRefLabel(token.surah, ordinal),
    position: token.position,
    is_basmala: token.is_basmala,
    text: {
      uthmani: token.text_uthmani,
      simple: token.text_simple,
      no_tashkeel: token.text_no_tashkeel,
      normalised: token.text_normalised,
    },
    morphology: token.morphology,
    url: absoluteUrl(wordHref(token.id)),
    api_url: absoluteUrl(`/api/v1/token/${encodeURIComponent(token.id)}`),
  };
}

function segmentDto(
  segment: Segment,
  ordinal: number | null,
  tokens: Token[],
): Record<string, unknown> {
  return {
    id: segment.id,
    surah: segment.surah,
    slot: segment.slot,
    ordinal,
    verse_ref: verseRefLabel(segment.surah, ordinal),
    ordinals: segment.ordinals,
    text: {
      uthmani: segment.text_uthmani,
      simple: segment.text_simple,
      no_tashkeel: segment.text_no_tashkeel,
      normalised: segment.text_normalised,
    },
    token_ids: tokens.map((t) => t.id),
    tokens: tokens.map((t) => tokenDto(t, ordinal)),
    translations: getVerseTranslations(segment.id).map((t) => ({
      edition_id: t.edition.id,
      translator: t.edition.translator,
      year: t.edition.year,
      licence: t.edition.licence,
      language: t.edition.language_code,
      alignment: 'verse-level',
      text: t.text,
    })),
    url: absoluteUrl(
      ordinal === null
        ? `/${segment.surah}`
        : verseHref(segment.surah, ordinal),
    ),
    api_url: absoluteUrl(
      `/api/v1/verse/${segment.surah}/${ordinal === null ? 'basmala' : ordinal}`,
    ),
  };
}

function viewDto(view: VerseView): Record<string, unknown> {
  return segmentDto(view.segment, view.ordinal, view.tokens);
}

function rootDto(root: Root): Record<string, unknown> {
  const view = describeRoot(root);
  return {
    root: root.root,
    slug: root.root_slug,
    transliteration: view.transliteration,
    occurrences: root.occurrences,
    distinct_forms: view.distinctForms,
    verse_count: view.verseCount,
    lemmas: root.lemmas,
    surah_distribution: view.surahDistribution.map((s) => ({
      surah: s.surah,
      name: s.name,
      count: s.count,
    })),
    forms: view.forms.map((f) => ({ form: f.form, count: f.count })),
    url: absoluteUrl(rootHref(root.root_slug)),
    api_url: absoluteUrl(`/api/v1/root/${root.root_slug}`),
  };
}

// ─── Endpoints ─────────────────────────────────────────────────────────────

/** GET /api/v1/versions — every published version resolvable through the API. */
export function versionsResponse(): ApiResult {
  const versions = listVersions();
  return {
    status: 200,
    body: {
      current: currentVersion(),
      versions: versions.map((v) => ({
        version: v,
        current: v === currentVersion(),
        manifest_url: absoluteUrl(`/api/v1/manifest?version=${v}`),
      })),
      ...meta(),
    },
  };
}

/** GET /api/v1/manifest — the build manifest for a version (default: current). */
export function manifestResponse(version?: string): ApiResult {
  const v = version ?? currentVersion();
  if (!isKnownVersion(v)) return notFound(`no such corpus version '${v}'`);
  const manifest = readManifest(v);
  return {
    status: 200,
    body: {
      manifest,
      resolved_version: v,
      is_current: v === currentVersion(),
      ...meta(),
    },
  };
}

/** GET /api/v1/surah/{n} — surah metadata and its verse list. */
export function surahResponse(n: number): ApiResult {
  const surah = getSurah(n);
  if (!surah) return notFound(`no such surah ${n}`);
  const verses = getSurahVerses(n);
  return {
    status: 200,
    body: {
      surah: {
        number: surah.number,
        name_ar: surah.name_ar,
        name_en: surah.name_en,
        name_translit: surah.name_translit,
        revelation_place: surah.revelation_place,
        revelation_order: surah.revelation_order,
        verse_count: surah.verse_count,
        basmala: {
          separated: surah.basmala.separated,
        },
        url: absoluteUrl(`/${surah.number}`),
      },
      verses: verses.map(viewDto),
      ...meta(),
    },
  };
}

/** GET /api/v1/verse/{surah}/{from-to} — one verse or an inclusive range. */
export function verseResponse(
  surah: number,
  from: number,
  to: number,
): ApiResult {
  if (!getSurah(surah)) return notFound(`no such surah ${surah}`);
  if (to < from) return badRequest('range end precedes start');
  const views: VerseView[] =
    from === to
      ? [getVerse(surah, from)].filter((v): v is VerseView => v !== undefined)
      : getVerseRange(surah, from, to);
  if (views.length === 0) return notFound(`no verse ${surah}:${from}`);
  return {
    status: 200,
    body: {
      reference: from === to ? `${surah}:${from}` : `${surah}:${from}-${to}`,
      verses: views.map(viewDto),
      ...meta(),
    },
  };
}

/** GET /api/v1/token/{id} — one token with its full morphology. */
export function tokenResponse(id: string): ApiResult {
  const token = getToken(id);
  if (!token) return notFound(`no such token '${id}'`);
  const segment = getIndex().segmentById.get(token.segment_id);
  const ordinal = segment
    ? (segment.ordinals[getActiveScheme()] ?? null)
    : null;
  return { status: 200, body: { token: tokenDto(token, ordinal), ...meta() } };
}

/** GET /api/v1/root/{slug} — a root and one page of its occurrences. */
export function rootResponse(slug: string, page = 1, perPage = 50): ApiResult {
  const root = getRootBySlug(slug) ?? findRootByArabic(slug);
  if (!root) return notFound(`no such root '${slug}'`);
  const occ = getRootOccurrences(root, page, perPage);
  return {
    status: 200,
    body: {
      ...rootDto(root),
      occurrence_page: {
        page: occ.page,
        page_count: occ.pageCount,
        per_page: perPage,
        total: occ.total,
        verses: occ.items.map((item) => ({
          id: item.view.segmentId,
          surah: item.view.surahNumber,
          ordinal: item.view.ordinal,
          verse_ref: verseRefLabel(item.view.surahNumber, item.view.ordinal),
          matched_token_ids: item.highlight,
          url: absoluteUrl(
            item.view.ordinal === null
              ? `/${item.view.surahNumber}`
              : verseHref(item.view.surahNumber, item.view.ordinal),
          ),
        })),
      },
      ...meta(),
    },
  };
}

export interface SearchOptions {
  page?: number | undefined;
  perPage?: number | undefined;
  includeBasmala?: boolean | undefined;
}

/** GET /api/v1/search — run a corpus query, paginating the matched tokens. */
export function searchResponse(q: string, opts: SearchOptions = {}): ApiResult {
  if (!q || q.trim() === '') return badRequest('missing query parameter q');
  const overrides =
    opts.includeBasmala === undefined
      ? {}
      : { includeBasmala: opts.includeBasmala };
  const outcome = searchString(getIndex(), q, overrides);
  if (!outcome.ok) {
    return {
      status: 422,
      body: {
        error: 'unparseable_query',
        message: outcome.error.message,
        position: outcome.error.position,
        query: q,
        ...meta(),
      },
    };
  }
  const result = outcome.result;
  const perPage = Math.min(Math.max(opts.perPage ?? 50, 1), 500);
  const page = Math.max(opts.page ?? 1, 1);
  const start = (page - 1) * perPage;
  const pageIds = result.tokenIds.slice(start, start + perPage);
  const matches = pageIds.flatMap((id) => {
    const token = getToken(id);
    if (!token) return [];
    const segment = getIndex().segmentById.get(token.segment_id);
    const ordinal = segment
      ? (segment.ordinals[getActiveScheme()] ?? null)
      : null;
    return [
      {
        token_id: token.id,
        verse_ref: verseRefLabel(token.surah, ordinal),
        surah: token.surah,
        text: token.text_uthmani,
        url: absoluteUrl(wordHref(token.id)),
      },
    ];
  });
  return {
    status: 200,
    body: {
      query: q,
      query_tree: result.query,
      total_matches: result.totalMatches,
      distinct_verses: result.segmentIds.length,
      page,
      per_page: perPage,
      page_count: Math.max(1, Math.ceil(result.totalMatches / perPage)),
      matches,
      corpus_version: result.corpusVersion,
      params: result.params,
      params_serialised: serialiseParams(result.params),
      text_edition: getTextEdition(),
      numbering_scheme: result.params.numberingScheme,
    },
  };
}

/** GET /api/v1/resolve?ref=2:43 — resolve a reference under the active scheme. */
export function resolveResponse(ref: string): ApiResult {
  if (!ref || ref.trim() === '') return badRequest('missing ref parameter');
  const m = /^(\d+):(\d+)(?:-(\d+))?$/.exec(ref.trim());
  if (!m)
    return badRequest(
      `'${ref}' is not a verse reference (expected s:v or s:v-w)`,
    );
  const surah = Number(m[1]);
  const from = Number(m[2]);
  const to = m[3] === undefined ? from : Number(m[3]);
  return verseResponse(surah, from, to);
}

/** GET /api/v1 — a description of the API and every read endpoint. */
export function rootIndexResponse(): ApiResult {
  const surahs = listSurahs();
  return {
    status: 200,
    body: {
      name: 'quranbench public API',
      version: 'v1',
      description:
        'Open, keyless, read-only access to the quranbench corpus. Every response carries the corpus version and computation parameters.',
      openapi: absoluteUrl('/api/v1/openapi.json'),
      surah_count: surahs.length,
      endpoints: {
        versions: absoluteUrl('/api/v1/versions'),
        manifest: absoluteUrl('/api/v1/manifest'),
        surah: absoluteUrl('/api/v1/surah/{number}'),
        verse: absoluteUrl('/api/v1/verse/{surah}/{ordinal}'),
        token: absoluteUrl('/api/v1/token/{id}'),
        root: absoluteUrl('/api/v1/root/{slug}'),
        search: absoluteUrl('/api/v1/search?q={query}'),
        resolve: absoluteUrl('/api/v1/resolve?ref={reference}'),
      },
      ...meta(),
    },
  };
}
