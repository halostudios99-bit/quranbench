import 'server-only';

import { resolve } from 'node:path';

import {
  loadCorpus,
  type Corpus,
  type LaneEntry,
  type LoadedTranslation,
  type Root,
  type Segment,
  type Surah,
  type Token,
  type TranslationEdition,
} from '@quranbench/corpus';
import {
  buildIndex,
  canonicaliseUthmani,
  type SearchIndex,
} from '@quranbench/search';

import { pageSlice, pageCount as pagesFor } from '@/lib/pagination';
import { rootHref, tokenRefLabel, verseHref } from '@/lib/addressing';
import {
  computeDivergence,
  reverseLookup,
  type DivergenceResult,
  type EditionText,
} from '@/lib/translations';
import { groupGloss, normaliseGloss, type GlossGrouping } from '@/lib/gloss';
import {
  rankSimilarVerses,
  type SimilarCandidate,
} from '@/lib/similar-verses';
import { rankCoOccurrence, tallyCoOccurrence } from '@/lib/co-occurrence';
import { pickWordIndex } from '@/lib/random-word';

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
  /** Verse-level translation editions, in manifest order. */
  translations: LoadedTranslation[];
  /** Corpus verse ids in reading order — the ordering basis for reverse lookup. */
  verseOrder: string[];
  /** Normalised English gloss → token handles carrying it (reverse gloss lookup). */
  glossIndex: Map<string, number[]>;
  /** Root slug → the verse ids it occurs in, in reading order (co-occurrence, similarity). */
  versesByRoot: Map<string, string[]>;
  /** Verse id → the set of root slugs occurring in it. */
  rootSlugsByVerse: Map<string, Set<string>>;
  /** Ubiquitous roots removed from similarity/co-occurrence signal (see /method). */
  similarityStoplist: Set<string>;
  loadMs: number;
}

// A root occurring in this many distinct verses or more carries no discriminative
// signal for similarity — it is on the stoplist. At the v0.8.0 threshold this is the
// eight most ubiquitous roots (Allah, say, be, lord, know, believe, people, that).
// Documented on /method; the exact members are printed from the loaded corpus.
export const SIMILARITY_STOPLIST_MIN_DF = 500;
/** How many similar verses a verse page shows. */
export const SIMILAR_VERSES_LIMIT = 8;
/** How many co-occurring roots a root page shows. */
export const CO_OCCURRENCE_LIMIT = 12;

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

  // Research indices, all built in a single pass over the tokens (a few
  // megabytes; see CLAUDE.md). Gloss lookup indexes every token by its normalised
  // English gloss. Root/verse structures back similar-verses and co-occurrence and
  // exclude separated basmalas, which are not counted verses.
  const glossIndex = new Map<string, number[]>();
  const versesByRootSet = new Map<string, Set<string>>();
  const rootSlugsByVerse = new Map<string, Set<string>>();
  corpus.tokens.forEach((token, handle) => {
    const gloss = token.morphology.gloss;
    if (gloss) {
      const key = normaliseGloss(gloss);
      const list = glossIndex.get(key);
      if (list) list.push(handle);
      else glossIndex.set(key, [handle]);
    }
    if (token.is_basmala) return;
    const slug = token.morphology.root_slug;
    if (!slug) return;
    const verseId = token.segment_id;
    let verseRoots = rootSlugsByVerse.get(verseId);
    if (!verseRoots) {
      verseRoots = new Set();
      rootSlugsByVerse.set(verseId, verseRoots);
    }
    verseRoots.add(slug);
    let rootVerses = versesByRootSet.get(slug);
    if (!rootVerses) {
      rootVerses = new Set();
      versesByRootSet.set(slug, rootVerses);
    }
    rootVerses.add(verseId);
  });

  const versesByRoot = new Map<string, string[]>();
  const similarityStoplist = new Set<string>();
  for (const [slug, verses] of versesByRootSet) {
    versesByRoot.set(slug, [...verses]);
    if (verses.size >= SIMILARITY_STOPLIST_MIN_DF) similarityStoplist.add(slug);
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
    translations: corpus.translations,
    verseOrder: corpus.segments.map((s) => s.id),
    glossIndex,
    versesByRoot,
    rootSlugsByVerse,
    similarityStoplist,
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

/** Lane's Lexicon entry for a root, or null when Lane has none (uneven coverage). */
export function getLaneEntry(slug: string): LaneEntry | null {
  return state().corpus.lexicon.get(slug) ?? null;
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
  /** Lane's Lexicon entry for this root, or null where Lane has no entry. */
  lane: LaneEntry | null;
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
    lane: getLaneEntry(root.root_slug),
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

// ─── Translations ──────────────────────────────────────────────────────────
// Verse-level licensed human translation editions. Never Quranic text: each is a
// labelled external edition, always shown with translator, edition, year and
// licence. Correspondence to Arabic is verse-level only — never word-level.

/** The available translation editions' metadata, in manifest order. */
export function listTranslationEditions(): TranslationEdition[] {
  return state().translations.map((t) => t.edition);
}

/**
 * Editions that may be redistributed (public domain / permissively licensed).
 * The reader shows every displayable edition, but the translation laboratory
 * (/compare) and the dataset downloads deal only in redistributable editions.
 */
export function listRedistributableEditions(): TranslationEdition[] {
  return state()
    .translations.map((t) => t.edition)
    .filter((e) => e.redistributable);
}

/** A concise "Translator (year)" label plus licence, for a ProvenanceTag note. */
export function translationLabel(edition: TranslationEdition): string {
  return `${edition.translator} (${edition.year}) · ${edition.licence}`;
}

export interface VerseTranslation {
  edition: TranslationEdition;
  text: string;
}

/**
 * Every edition's rendering of one verse, in manifest order. `editionIds`, when
 * given, restricts and orders the result to those editions (the reader setting).
 */
export function getVerseTranslations(
  verseId: string,
  editionIds?: string[],
): VerseTranslation[] {
  const wanted = editionIds ? new Set(editionIds) : null;
  const out: VerseTranslation[] = [];
  for (const t of state().translations) {
    if (wanted && !wanted.has(t.edition.id)) continue;
    const text = t.byVerseId.get(verseId);
    if (text !== undefined) out.push({ edition: t.edition, text });
  }
  return out;
}

/** Lexical divergence across editions for one verse (see lib/translations). */
export function getVerseDivergence(
  verseId: string,
  editionIds?: string[],
): DivergenceResult {
  const editions: EditionText[] = getVerseTranslations(verseId, editionIds).map((v) => ({
    editionId: v.edition.id,
    text: v.text,
  }));
  return computeDivergence(editions);
}

export interface ReverseLookupOccurrence {
  verseId: string;
  ref: string;
  href: string;
  /** Editions whose rendering of this verse contains the query word. */
  editions: { edition: TranslationEdition; text: string }[];
  /** The Arabic tokens of the verse — verse-level correspondence, not word-level. */
  tokens: Token[];
}

export interface ReverseLookupView {
  word: string;
  total: number;
  occurrences: ReverseLookupOccurrence[];
}

/**
 * Reverse lookup: which verses render an English word, and the Arabic tokens in
 * those verses. Verse-level correspondence only — the UI must say so. `limit`
 * caps the rendered occurrences; `total` reports the full count.
 */
export function reverseLookupWord(
  query: string,
  limit: number,
  editionIds?: string[],
): ReverseLookupView {
  const s = state();
  const wanted = editionIds ? new Set(editionIds) : null;
  const scoped = wanted
    ? s.translations.filter((t) => wanted.has(t.edition.id))
    : s.translations;
  const editionsByVerse = scoped.map((t) => ({
    editionId: t.edition.id,
    byVerseId: t.byVerseId,
  }));
  const editionById = new Map(scoped.map((t) => [t.edition.id, t]));
  const result = reverseLookup(query, editionsByVerse, s.verseOrder);
  const occurrences: ReverseLookupOccurrence[] = result.verses
    .slice(0, limit)
    .map((v) => {
      const segment = s.index.segmentById.get(v.verseId);
      const ordinal = segment ? (segment.ordinals[s.scheme] ?? null) : null;
      const surah = segment?.surah ?? 0;
      return {
        verseId: v.verseId,
        ref: ordinal === null ? v.verseId : `${surah}:${ordinal}`,
        href: ordinal === null ? `/${surah}` : verseHref(surah, ordinal),
        editions: v.editionIds.flatMap((id) => {
          const t = editionById.get(id);
          const text = t?.byVerseId.get(v.verseId);
          return t && text !== undefined ? [{ edition: t.edition, text }] : [];
        }),
        tokens: s.tokensBySegment.get(v.verseId) ?? [],
      };
    });
  return { word: result.word, total: result.total, occurrences };
}

// ─── Reverse gloss lookup ────────────────────────────────────────────────────
// Every Arabic token rendered by one English gloss, grouped by root and lemma.
// The correspondence is a word-level gloss from the Leeds QAC (GPL) — an external
// annotation, never a translation of the whole verse and never Quranic text.

export interface GlossView {
  /** The gloss as first written in the corpus, for display. */
  gloss: string;
  /** The normalised key the lookup matched on. */
  key: string;
  grouping: GlossGrouping<OccurrenceRef>;
}

/** Resolve a gloss (raw or normalised) to its grouped occurrences, or undefined. */
export function describeGloss(word: string): GlossView | undefined {
  const s = state();
  const key = normaliseGloss(word);
  const handles = s.glossIndex.get(key);
  if (!handles || handles.length === 0) return undefined;
  const tokens = tokensForHandles(handles);
  const grouping = groupGloss(
    tokens.map((t) => ({
      rootSlug: t.morphology.root_slug,
      root: t.morphology.root,
      lemma: t.morphology.lemma,
      ref: occurrenceRef(t),
    })),
  );
  return { gloss: tokens[0]!.morphology.gloss ?? key, key, grouping };
}

export interface GlossListing {
  gloss: string;
  key: string;
  total: number;
  rootCount: number;
}

/**
 * Glosses worth a permalink in the sitemap: those spanning two or more distinct
 * roots — the "different Arabic words, same rendering" cases the tool exists for.
 * A single-root gloss still resolves at its URL; it is just not advertised.
 */
export function listReverseGlosses(): GlossListing[] {
  const s = state();
  const out: GlossListing[] = [];
  for (const [key, handles] of s.glossIndex) {
    const roots = new Set<string>();
    for (const h of handles) {
      const slug = s.corpus.tokens[h]!.morphology.root_slug;
      roots.add(slug ?? ' no-root');
    }
    if (roots.size < 2) continue;
    const first = s.corpus.tokens[handles[0]!]!;
    out.push({
      gloss: first.morphology.gloss ?? key,
      key,
      total: handles.length,
      rootCount: roots.size,
    });
  }
  return out.sort((a, b) => b.rootCount - a.rootCount || b.total - a.total);
}

// ─── Similar verses ──────────────────────────────────────────────────────────

export interface SharedRoot {
  slug: string;
  root: string;
  href: string;
}

export interface SimilarVerseView {
  verseId: string;
  surah: number;
  surahName: string;
  ordinal: number;
  ref: string;
  href: string;
  score: number;
  scorePct: number;
  intersection: number;
  union: number;
  shared: SharedRoot[];
}

export interface SimilarVersesResult {
  items: SimilarVerseView[];
  /** Content roots of the target verse (stoplist removed) used for the measure. */
  targetRoots: SharedRoot[];
  /** Stoplisted roots present in the target verse but excluded from the measure. */
  excluded: SharedRoot[];
}

function sharedRoot(slug: string): SharedRoot {
  const root = state().rootBySlug.get(slug);
  return {
    slug,
    root: root?.root ?? slug,
    href: rootHref(slug),
  };
}

/** Content root slugs of a verse (stoplist removed). */
function contentRoots(segmentId: string): Set<string> {
  const s = state();
  const all = s.rootSlugsByVerse.get(segmentId);
  if (!all) return new Set();
  const out = new Set<string>();
  for (const slug of all) if (!s.similarityStoplist.has(slug)) out.add(slug);
  return out;
}

/**
 * The verses most similar to one verse, by Jaccard over stoplisted root sets. Only
 * candidate verses sharing a content root are considered, gathered through the
 * root→verses index, so cost is bounded by the target's roots, not the corpus.
 */
export function listSimilarVerses(
  segmentId: string,
  limit = SIMILAR_VERSES_LIMIT,
): SimilarVersesResult {
  const s = state();
  const targetSet = contentRoots(segmentId);
  const excluded = [...(s.rootSlugsByVerse.get(segmentId) ?? [])]
    .filter((slug) => s.similarityStoplist.has(slug))
    .map(sharedRoot);
  const targetRoots = [...targetSet].map(sharedRoot);
  if (targetSet.size === 0) return { items: [], targetRoots, excluded };

  const candidates = new Map<string, SimilarCandidate>();
  for (const slug of targetSet) {
    for (const verseId of s.versesByRoot.get(slug) ?? []) {
      if (verseId === segmentId || candidates.has(verseId)) continue;
      candidates.set(verseId, { verseId, roots: contentRoots(verseId) });
    }
  }

  const ranked = rankSimilarVerses(targetSet, candidates.values(), limit);
  const items = ranked.flatMap((r): SimilarVerseView[] => {
    const segment = s.index.segmentById.get(r.verseId);
    if (!segment) return [];
    const ordinal = segment.ordinals[s.scheme];
    if (ordinal === undefined) return [];
    const surah = getSurah(segment.surah);
    return [
      {
        verseId: r.verseId,
        surah: segment.surah,
        surahName: surah?.name_en ?? `Surah ${segment.surah}`,
        ordinal,
        ref: `${segment.surah}:${ordinal}`,
        href: verseHref(segment.surah, ordinal),
        score: r.score,
        scorePct: Math.round(r.score * 100),
        intersection: r.intersection,
        union: r.union,
        shared: r.shared.map(sharedRoot),
      },
    ];
  });
  return { items, targetRoots, excluded };
}

// ─── Root co-occurrence ──────────────────────────────────────────────────────

export interface CoOccurrenceView {
  slug: string;
  root: string;
  href: string;
  sharedVerses: number;
  occurrences: number;
}

export interface RootCoOccurrenceResult {
  /** Distinct verses the subject root occurs in — the co-occurrence universe. */
  verseCount: number;
  items: CoOccurrenceView[];
}

/**
 * Which roots most often share a verse with this one. Window: the verse. Measure:
 * distinct shared verses. Ubiquitous (stoplisted) roots are excluded from the
 * results so genuinely connected concepts surface.
 */
export function rootCoOccurrences(
  slug: string,
  limit = CO_OCCURRENCE_LIMIT,
): RootCoOccurrenceResult {
  const s = state();
  const verseIds = s.versesByRoot.get(slug) ?? [];
  const verseRootSets = verseIds.flatMap((id) => {
    const set = s.rootSlugsByVerse.get(id);
    return set ? [set] : [];
  });
  const tally = tallyCoOccurrence(slug, verseRootSets, s.similarityStoplist);
  const items = rankCoOccurrence(tally, limit).map((c) => {
    const root = s.rootBySlug.get(c.rootSlug);
    return {
      slug: c.rootSlug,
      root: root?.root ?? c.rootSlug,
      href: rootHref(c.rootSlug),
      sharedVerses: c.sharedVerses,
      occurrences: root?.occurrences ?? 0,
    };
  });
  return { verseCount: verseIds.length, items };
}

/** The stoplist members, for display on /method and page footers. */
export function similarityStoplist(): SharedRoot[] {
  return [...state().similarityStoplist]
    .map(sharedRoot)
    .sort((a, b) => {
      const ao = state().rootBySlug.get(a.slug)?.occurrences ?? 0;
      const bo = state().rootBySlug.get(b.slug)?.occurrences ?? 0;
      return bo - ao;
    });
}

// ─── Random word ─────────────────────────────────────────────────────────────

/** A random token id, deterministic when `seed` is given. Null on an empty corpus. */
export function randomTokenId(seed: string | null): string | null {
  const tokens = state().corpus.tokens;
  const index = pickWordIndex(seed, tokens.length);
  return index < 0 ? null : tokens[index]!.id;
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
