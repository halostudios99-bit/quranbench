// Surah-name validation, driven entirely by corpus metadata (never a hardcoded
// list). Distinguishes a spelling variant of the right surah from a name that
// belongs to a different surah than the number cites.

import type { Corpus, Surah } from '@quranbench/corpus';
import { similarity } from './text.js';

/** Assimilating definite-article prefixes to drop before comparison. */
const ARTICLE = /\b(al|an|as|ash|ar|at|ath|ad|adh|az|el)\b/g;

export function normaliseName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’`]/g, '')
    .replace(/-/g, ' ')
    .replace(ARTICLE, ' ')
    .replace(/[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Consonant skeleton — folds transliteration vowel differences (Nur/Noor, Khaf/Kahf). */
function consonants(s: string): string {
  return normaliseName(s).replace(/[aeiouy ]/g, '');
}

/**
 * Similarity that ignores vowel-transliteration variance by also comparing
 * consonant skeletons. "An-Nur"/"An-Noor" and "Al-Khaf"/"Al-Kahf" score ~1;
 * "Al-Maida"/"An-Naml" stays low.
 */
export function nameSimilarity(a: string, b: string): number {
  const whole = similarity(normaliseName(a), normaliseName(b));
  const skel = similarity(consonants(a), consonants(b));
  return Math.max(whole, skel);
}

export interface SurahMatch {
  number: number;
  score: number;
}

export class SurahMatcher {
  private readonly bySlug: { number: number; slugs: string[] }[];

  constructor(private readonly surahs: Surah[]) {
    this.bySlug = surahs.map((s) => ({
      number: s.number,
      slugs: [normaliseName(s.name_translit), normaliseName(s.name_en)].filter(Boolean),
    }));
  }

  canonical(num: number): Surah | undefined {
    return this.surahs[num - 1];
  }

  /** Best similarity of `name` to the canonical names of surah `num`. */
  score(name: string, num: number): number {
    const entry = this.bySlug[num - 1];
    if (!entry) return 0;
    return Math.max(0, ...entry.slugs.map((slug) => nameSimilarity(name, slug)));
  }

  /** The surah whose canonical name best matches `name`, across all 114. */
  bestMatch(name: string): SurahMatch | null {
    if (!normaliseName(name)) return null;
    let best: SurahMatch | null = null;
    for (const entry of this.bySlug) {
      const score = Math.max(0, ...entry.slugs.map((slug) => nameSimilarity(name, slug)));
      if (!best || score > best.score) best = { number: entry.number, score };
    }
    return best;
  }
}

export function buildSurahMatcher(corpus: Corpus): SurahMatcher {
  return new SurahMatcher(corpus.surahs);
}
