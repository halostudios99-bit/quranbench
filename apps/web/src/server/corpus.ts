import 'server-only';

import { resolve } from 'node:path';

import {
  loadCorpus,
  type Corpus,
  type Root,
  type Segment,
  type Surah,
  type Token,
} from '@quranbench/corpus';
import {
  buildIndex,
  canonicaliseUthmani,
  type SearchIndex,
} from '@quranbench/search';

import { pageSlice, pageCount as pagesFor } from '@/lib/pagination';
import { tokenRefLabel, verseHref } from '@/lib/addressing';

// The whole corpus is a few megabytes and fits in RAM (see CLAUDE.md). It is
// loaded and indexed exactly once per server process — a module-level singleton,
// never per request. Everything the reader renders is derived from these maps.

export interface VerseView {
  segment: Segment;
  ordinal: number;
  tokens: Token[];
}

interface CorpusState {
  corpus: Corpus;
  index: SearchIndex;
  scheme: string;
  surahByNumber: Map<number, Surah>;
  tokensBySegment: Map<string, Token[]>;
  versesBySurah: Map<number, VerseView[]>;
  /** Canonical slug → Root record. */
  rootBySlug: Map<string, Root>;
  /** Root identity forms → Root: the spaced form (`ز ك و`) and its unspaced form. */
  rootByForm: Map<string, Root>;
  loadMs: number;
}

/** Artifacts live at <repo>/packages/corpus-build/out, two levels up from apps/web. */
function artifactsRoot(): string {
  return resolve(process.cwd(), '..', '..', 'packages', 'corpus-build', 'out');
}

function build(): CorpusState {
  const started = performance.now();
  const corpus = loadCorpus(undefined, { root: artifactsRoot() });
  const index = buildIndex(corpus);
  const scheme = index.activeScheme;

  const surahByNumber = new Map<number, Surah>();
  for (const s of corpus.surahs) surahByNumber.set(s.number, s);

  const tokensBySegment = new Map<string, Token[]>();
  for (const token of corpus.tokens) {
    const list = tokensBySegment.get(token.segment_id);
    if (list) list.push(token);
    else tokensBySegment.set(token.segment_id, [token]);
  }

  const versesBySurah = new Map<number, VerseView[]>();
  for (const segment of corpus.segments) {
    const ordinal = segment.ordinals[scheme];
    if (ordinal === undefined) continue;
    const view: VerseView = {
      segment,
      ordinal,
      tokens: tokensBySegment.get(segment.id) ?? [],
    };
    const list = versesBySurah.get(segment.surah);
    if (list) list.push(view);
    else versesBySurah.set(segment.surah, [view]);
  }
  for (const list of versesBySurah.values())
    list.sort((a, b) => a.ordinal - b.ordinal);

  // Root lookup by canonical slug and by either Arabic identity form. The Arabic
  // aliases let a pasted `ز ك و` (spaced or not) redirect to its canonical slug.
  const rootBySlug = new Map<string, Root>();
  const rootByForm = new Map<string, Root>();
  for (const r of corpus.roots) {
    rootBySlug.set(r.root_slug, r);
    rootByForm.set(r.root, r);
    rootByForm.set(r.root.replace(/\s+/g, ''), r);
  }

  const loadMs = performance.now() - started;
  if (process.env.NODE_ENV !== 'test') {
    console.info(
      `[corpus] loaded v${corpus.version}: ${corpus.tokens.length} tokens, ` +
        `${corpus.segments.length} verses in ${loadMs.toFixed(0)}ms`,
    );
  }

  return {
    corpus,
    index,
    scheme,
    surahByNumber,
    tokensBySegment,
    versesBySurah,
    rootBySlug,
    rootByForm,
    loadMs,
  };
}

// Cache across hot reloads in dev so the corpus is not re-read on every request.
const globalForCorpus = globalThis as unknown as { __qbCorpus?: CorpusState };
function state(): CorpusState {
  return (globalForCorpus.__qbCorpus ??= build());
}

export function getCorpus(): Corpus {
  return state().corpus;
}

export function getIndex(): SearchIndex {
  return state().index;
}

export function getActiveScheme(): string {
  return state().scheme;
}

export function getCorpusLoadMs(): number {
  return state().loadMs;
}

export function listSurahs(): Surah[] {
  return state().corpus.surahs;
}

export function getSurah(number: number): Surah | undefined {
  return state().surahByNumber.get(number);
}

export function getSurahVerses(number: number): VerseView[] {
  return state().versesBySurah.get(number) ?? [];
}

/**
 * The separated surah-opening basmala as its own token group, or null when the
 * surah's basmala is inline (surah 1) or absent (surah 9). It is not a verse row.
 */
export function getBasmalaTokens(number: number): Token[] | null {
  const surah = getSurah(number);
  if (!surah || !surah.basmala || !surah.basmala.separated) return null;
  const tokens = state().tokensBySegment.get(
    `quran:tanzil-uthmani:${number}:basmala`,
  );
  return tokens && tokens.length > 0 ? tokens : null;
}

export function getVerse(
  surah: number,
  ordinal: number,
): VerseView | undefined {
  const bySurah = state().index.refIndex.get(surah);
  const segment = bySurah?.get(ordinal);
  if (!segment) return undefined;
  return {
    segment,
    ordinal,
    tokens: state().tokensBySegment.get(segment.id) ?? [],
  };
}

export function getVerseRange(
  surah: number,
  from: number,
  to: number,
): VerseView[] {
  const out: VerseView[] = [];
  for (let ordinal = from; ordinal <= to; ordinal++) {
    const view = getVerse(surah, ordinal);
    if (view) out.push(view);
  }
  return out;
}

export function getToken(id: string): Token | undefined {
  const handle = state().index.byId.get(id);
  return handle === undefined ? undefined : state().corpus.tokens[handle];
}

export interface SegmentView {
  segmentId: string;
  surahNumber: number;
  surahName: string;
  /** Verse ordinal under the active scheme, or null for a separated basmala. */
  ordinal: number | null;
  tokens: Token[];
  basmala: boolean;
}

/** Resolve a segment id (verse row or separated basmala) to a renderable view. */
export function describeSegment(segmentId: string): SegmentView | undefined {
  const s = state();
  const tokens = s.tokensBySegment.get(segmentId) ?? [];
  const segment = s.index.segmentById.get(segmentId);
  if (segment) {
    const surah = getSurah(segment.surah);
    return {
      segmentId,
      surahNumber: segment.surah,
      surahName: surah?.name_en ?? `Surah ${segment.surah}`,
      ordinal: segment.ordinals[s.scheme] ?? null,
      tokens,
      basmala: false,
    };
  }
  const m = /:(\d+):basmala$/.exec(segmentId);
  if (m && tokens.length > 0) {
    const surahNumber = Number(m[1]);
    const surah = getSurah(surahNumber);
    return {
      segmentId,
      surahNumber,
      surahName: surah?.name_en ?? `Surah ${surahNumber}`,
      ordinal: null,
      tokens,
      basmala: true,
    };
  }
  return undefined;
}

/** Verse ordinal of a segment under the active scheme, or null (separated basmala). */
function ordinalOf(segmentId: string): number | null {
  const s = state();
  const segment = s.index.segmentById.get(segmentId);
  return segment ? (segment.ordinals[s.scheme] ?? null) : null;
}

/** A lightweight, linkable reference to one occurrence — never copied Arabic. */
export interface OccurrenceRef {
  tokenId: string;
  segmentId: string;
  surah: number;
  ordinal: number | null;
  position: number;
  text: string;
  ref: string;
  href: string;
  wordHref: string;
}

function occurrenceRef(token: Token): OccurrenceRef {
  const ordinal = ordinalOf(token.segment_id);
  return {
    tokenId: token.id,
    segmentId: token.segment_id,
    surah: token.surah,
    ordinal,
    position: token.position,
    text: token.text_uthmani,
    ref: tokenRefLabel(token.surah, ordinal, token.position),
    href:
      ordinal === null ? `/${token.surah}` : verseHref(token.surah, ordinal),
    wordHref: `/word/${encodeURIComponent(token.id)}`,
  };
}

function tokensForHandles(handles: number[] | undefined): Token[] {
  if (!handles) return [];
  const tokens = state().corpus.tokens;
  return handles.map((h) => tokens[h]!).filter(Boolean);
}

/** How many occurrence previews a word page shows before linking to the full set. */
export const WORD_PREVIEW_LIMIT = 12;

export interface WordView {
  token: Token;
  surah: Surah;
  segmentId: string;
  ordinal: number | null;
  isBasmala: boolean;
  ref: string;
  verseRef: string;
  verseHref: string;
  verse: SegmentView;
  prev: OccurrenceRef | null;
  next: OccurrenceRef | null;
  sameForm: { total: number; preview: OccurrenceRef[]; hasMore: boolean };
  root: {
    root: string;
    slug: string;
    lemma: string | null;
    total: number;
    distinctForms: number;
    preview: OccurrenceRef[];
    hasMore: boolean;
  } | null;
}

/** Everything a word page renders, resolved from the in-memory index. */
export function describeToken(id: string): WordView | undefined {
  const s = state();
  const handle = s.index.byId.get(id);
  if (handle === undefined) return undefined;
  const token = s.corpus.tokens[handle]!;
  const surah = getSurah(token.surah);
  if (!surah) return undefined;

  const verse = describeSegment(token.segment_id);
  if (!verse) return undefined;
  const ordinal = verse.ordinal;

  const prevTok = handle > 0 ? s.corpus.tokens[handle - 1] : undefined;
  const nextTok =
    handle + 1 < s.corpus.tokens.length
      ? s.corpus.tokens[handle + 1]
      : undefined;

  const exactHandles =
    s.index.exact.get(canonicaliseUthmani(token.text_uthmani)) ?? [];
  const sameFormOthers = tokensForHandles(exactHandles).filter(
    (t) => t.id !== token.id,
  );

  const morph = token.morphology;
  let root: WordView['root'] = null;
  if (morph.root && morph.root_slug) {
    const rootRec = s.rootBySlug.get(morph.root_slug);
    const rootHandles = s.index.root.get(morph.root) ?? [];
    const rootOthers = tokensForHandles(rootHandles).filter(
      (t) => t.id !== token.id,
    );
    root = {
      root: morph.root,
      slug: morph.root_slug,
      lemma: morph.lemma,
      total: rootRec ? rootRec.occurrences : rootHandles.length,
      distinctForms: rootRec ? distinctFormCount(rootRec) : 0,
      preview: rootOthers.slice(0, WORD_PREVIEW_LIMIT).map(occurrenceRef),
      hasMore: rootOthers.length > WORD_PREVIEW_LIMIT,
    };
  }

  return {
    token,
    surah,
    segmentId: token.segment_id,
    ordinal,
    isBasmala: token.is_basmala,
    ref: tokenRefLabel(token.surah, ordinal, token.position),
    verseRef:
      ordinal === null ? `${token.surah}:basmala` : `${token.surah}:${ordinal}`,
    verseHref:
      ordinal === null ? `/${token.surah}` : verseHref(token.surah, ordinal),
    verse,
    prev: prevTok ? occurrenceRef(prevTok) : null,
    next: nextTok ? occurrenceRef(nextTok) : null,
    sameForm: {
      total: exactHandles.length,
      preview: sameFormOthers.slice(0, WORD_PREVIEW_LIMIT).map(occurrenceRef),
      hasMore: sameFormOthers.length > WORD_PREVIEW_LIMIT,
    },
    root,
  };
}

function distinctFormCount(root: Root): number {
  const forms = new Set<string>();
  for (const id of root.token_ids) {
    const token = getToken(id);
    if (token) forms.add(canonicaliseUthmani(token.text_uthmani));
  }
  return forms.size;
}

export function getRootBySlug(slug: string): Root | undefined {
  return state().rootBySlug.get(slug);
}

/** Resolve a pasted Arabic root form (spaced or not) to its record, for redirect. */
export function findRootByArabic(text: string): Root | undefined {
  const s = state();
  return s.rootByForm.get(text) ?? s.rootByForm.get(text.replace(/\s+/g, ''));
}

export interface RootFormGroup {
  form: string;
  count: number;
  representative: OccurrenceRef;
}

export interface RootSurahCount {
  surah: number;
  name: string;
  count: number;
}

export interface RootLemmaCount {
  lemma: string;
  count: number;
  representative: OccurrenceRef;
}

export interface RootView {
  root: Root;
  transliteration: string;
  occurrences: number;
  distinctForms: number;
  forms: RootFormGroup[];
  surahDistribution: RootSurahCount[];
  maxSurahCount: number;
  first: OccurrenceRef;
  last: OccurrenceRef;
  lemmas: RootLemmaCount[];
  /** Distinct verses the root appears in — the length of the paginated list. */
  verseCount: number;
}

/** Everything a root page renders except the paginated occurrence list itself. */
export function describeRoot(root: Root): RootView {
  const tokens = root.token_ids
    .map(getToken)
    .filter((t): t is Token => t !== undefined);

  const formGroups = new Map<string, { count: number; first: Token }>();
  const surahCounts = new Map<number, number>();
  const lemmaCounts = new Map<string, { count: number; first: Token }>();
  const verseIds = new Set<string>();

  for (const token of tokens) {
    const form = canonicaliseUthmani(token.text_uthmani);
    const fg = formGroups.get(form);
    if (fg) fg.count++;
    else formGroups.set(form, { count: 1, first: token });

    surahCounts.set(token.surah, (surahCounts.get(token.surah) ?? 0) + 1);
    verseIds.add(token.segment_id);

    const lemma = token.morphology.lemma;
    if (lemma) {
      const lg = lemmaCounts.get(lemma);
      if (lg) lg.count++;
      else lemmaCounts.set(lemma, { count: 1, first: token });
    }
  }

  const forms: RootFormGroup[] = [...formGroups.entries()]
    .map(([, v]) => ({
      form: v.first.text_uthmani,
      count: v.count,
      representative: occurrenceRef(v.first),
    }))
    .sort((a, b) => b.count - a.count);

  const surahDistribution: RootSurahCount[] = [...surahCounts.entries()]
    .map(([surah, count]) => ({
      surah,
      name: getSurah(surah)?.name_en ?? `Surah ${surah}`,
      count,
    }))
    .sort((a, b) => a.surah - b.surah);
  const maxSurahCount = surahDistribution.reduce(
    (m, s) => Math.max(m, s.count),
    0,
  );

  const lemmas: RootLemmaCount[] = root.lemmas
    .map((lemma) => {
      const g = lemmaCounts.get(lemma);
      return g
        ? { lemma, count: g.count, representative: occurrenceRef(g.first) }
        : { lemma, count: 0, representative: occurrenceRef(tokens[0]!) };
    })
    .sort((a, b) => b.count - a.count);

  return {
    root,
    transliteration: root.root_slug.split('-').join(' · '),
    occurrences: root.occurrences,
    distinctForms: formGroups.size,
    forms,
    surahDistribution,
    maxSurahCount,
    first: occurrenceRef(tokens[0]!),
    last: occurrenceRef(tokens[tokens.length - 1]!),
    lemmas,
    verseCount: verseIds.size,
  };
}

export interface RootOccurrencePage {
  page: number;
  pageCount: number;
  total: number;
  items: { view: SegmentView; highlight: string[] }[];
}

/** One page of a root's occurrence list: distinct verses in corpus order. */
export function getRootOccurrences(
  root: Root,
  page: number,
  perPage: number,
): RootOccurrencePage {
  // Distinct verses in corpus order, and which of their tokens carry this root.
  const order: string[] = [];
  const rootTokensBySegment = new Map<string, string[]>();
  for (const id of root.token_ids) {
    const token = getToken(id);
    if (!token) continue;
    const list = rootTokensBySegment.get(token.segment_id);
    if (list) list.push(id);
    else {
      rootTokensBySegment.set(token.segment_id, [id]);
      order.push(token.segment_id);
    }
  }

  const total = order.length;
  const pages = pagesFor(total, perPage);
  const clamped = Math.min(Math.max(page, 1), pages);
  const { start, end } = pageSlice(clamped, perPage);
  const items = order.slice(start, end).flatMap((segmentId) => {
    const view = describeSegment(segmentId);
    return view
      ? [{ view, highlight: rootTokensBySegment.get(segmentId) ?? [] }]
      : [];
  });

  return { page: clamped, pageCount: pages, total, items };
}

/** Text edition label for provenance display (the Uthmani text edition source). */
export function getTextEdition(): string {
  const sources = state().corpus.sources;
  const source =
    sources.find((s) => s.id === 'tanzil-uthmani') ??
    sources.find((s) => s.role === 'text-edition') ??
    sources[0];
  return source
    ? source.edition.replace(/^Uthmani/i, 'Tanzil Uthmani').trim()
    : 'Tanzil Uthmani';
}
