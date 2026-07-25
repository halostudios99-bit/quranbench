import 'server-only';

import { resolve } from 'node:path';

import {
  loadCorpus,
  type Corpus,
  type Segment,
  type Surah,
  type Token,
} from '@quranbench/corpus';
import { buildIndex, type SearchIndex } from '@quranbench/search';

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
  for (const list of versesBySurah.values()) list.sort((a, b) => a.ordinal - b.ordinal);

  const loadMs = performance.now() - started;
  if (process.env.NODE_ENV !== 'test') {
    console.info(
      `[corpus] loaded v${corpus.version}: ${corpus.tokens.length} tokens, ` +
        `${corpus.segments.length} verses in ${loadMs.toFixed(0)}ms`,
    );
  }

  return { corpus, index, scheme, surahByNumber, tokensBySegment, versesBySurah, loadMs };
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
  const tokens = state().tokensBySegment.get(`quran:tanzil-uthmani:${number}:basmala`);
  return tokens && tokens.length > 0 ? tokens : null;
}

export function getVerse(surah: number, ordinal: number): VerseView | undefined {
  const bySurah = state().index.refIndex.get(surah);
  const segment = bySurah?.get(ordinal);
  if (!segment) return undefined;
  return { segment, ordinal, tokens: state().tokensBySegment.get(segment.id) ?? [] };
}

export function getVerseRange(surah: number, from: number, to: number): VerseView[] {
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

/** Text edition label for provenance display (the Uthmani text edition source). */
export function getTextEdition(): string {
  const sources = state().corpus.sources;
  const source =
    sources.find((s) => s.id === 'tanzil-uthmani') ??
    sources.find((s) => s.role === 'text-edition') ??
    sources[0];
  return source ? source.edition.replace(/^Uthmani/i, 'Tanzil Uthmani').trim() : 'Tanzil Uthmani';
}
