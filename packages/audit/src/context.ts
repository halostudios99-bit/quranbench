// The corpus-backed context an audit runs against. Built once, reused across
// every article. Holds the loaded corpus, the search index, the surah-name
// matcher, and a tolerant word→root index used only to locate the word a root
// claim is about (the article's orthography often differs from the Uthmani
// text, so an exact normalised lookup is not enough to *find* the word).

import type { Corpus, Token } from '@quranbench/corpus';
import { buildIndex, normaliseArabic, type SearchIndex } from '@quranbench/search';
import { buildSurahMatcher, type SurahMatcher } from './surahs.js';

/** Weak letters, carriers and vowels — dropped when forming a strong skeleton. */
const WEAK = new Set(['ا', 'و', 'ي', 'ه', 'ء']);

/**
 * A strong-consonant skeleton: normalise, drop a leading definite article, then
 * remove weak letters. Tolerates alef/waw orthographic differences (الزكاة vs
 * الزكوة) so the word can be located regardless of script edition.
 */
export function strongSkeleton(word: string): string {
  let s = normaliseArabic(word);
  if (s.startsWith('ال')) s = s.slice(2);
  let out = '';
  for (const ch of s) if (!WEAK.has(ch)) out += ch;
  return out;
}

/** Compare roots ignoring the spaces the corpus uses between root letters. */
export function joinRoot(root: string): string {
  return normaliseArabic(root.replace(/\s+/g, ''));
}

export interface AuditContext {
  corpus: Corpus;
  index: SearchIndex;
  version: string;
  surahs: SurahMatcher;
  /** strong skeleton → corpus roots (spaced) carried by matching words, by frequency. */
  rootBySkeleton: Map<string, Map<string, number>>;
  /** every strong skeleton present in the corpus — tolerates orthographic variants. */
  skeletons: Set<string>;
  /** per-segment normalised word set + consonant blob, for "which verse" scans. */
  segmentNormalised: { id: string; ref: string; words: Set<string>; cons: string }[];
}

/** Concatenated strong-consonant skeleton of a space-separated text. */
export function consonantBlob(text: string): string {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map(strongSkeleton)
    .join('');
}

function buildRootBySkeleton(tokens: Token[]): Map<string, Map<string, number>> {
  const map = new Map<string, Map<string, number>>();
  for (const t of tokens) {
    const root = t.morphology.root;
    if (!root) continue;
    const skel = strongSkeleton(t.text_normalised);
    if (skel.length < 2) continue;
    let counts = map.get(skel);
    if (!counts) map.set(skel, (counts = new Map()));
    counts.set(root, (counts.get(root) ?? 0) + 1);
  }
  return map;
}

export function createContext(corpus: Corpus): AuditContext {
  const index = buildIndex(corpus);
  const segmentNormalised = corpus.segments.map((seg) => ({
    id: seg.id,
    ref: `${seg.surah}:${seg.slot}`,
    words: new Set(seg.text_normalised.split(/\s+/).filter(Boolean)),
    cons: consonantBlob(seg.text_normalised),
  }));
  const skeletons = new Set<string>();
  for (const t of corpus.tokens) {
    const skel = strongSkeleton(t.text_normalised);
    if (skel.length >= 2) skeletons.add(skel);
  }
  return {
    corpus,
    index,
    version: corpus.version,
    surahs: buildSurahMatcher(corpus),
    rootBySkeleton: buildRootBySkeleton(corpus.tokens),
    skeletons,
    segmentNormalised,
  };
}

/** Roots recorded for a word's strong skeleton, most frequent first. */
export function rootsForSkeleton(ctx: AuditContext, skeleton: string): string[] {
  const counts = ctx.rootBySkeleton.get(skeleton);
  if (!counts) return [];
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([root]) => root);
}
