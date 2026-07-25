// Pure functions over translation editions: divergence detection and reverse
// lookup. No I/O, no database, no Next.js — these operate on plain text passed in,
// so they are unit-testable in isolation. They never touch Quranic text and never
// call a machine-translation service (rule 7): they compare licensed human editions.

/**
 * Function words excluded before comparing editions, so divergence reflects
 * content, not grammar. Includes archaic pronouns/particles (ye, thy, thou, lo,
 * verily) common to the early-20th-century public-domain editions.
 */
const STOPWORDS = new Set(
  (
    'the a an and or of to in on for with is are am be been being was were as by ' +
    'that this these those it its his her their they them he she we you your yours ' +
    'ye thy thee thou thine hath doth hast art shall will would then than so if ' +
    'when who whom which what all any some more most such no nor not but from at ' +
    'into unto o our my me us him lo yea verily indeed there here where whose upon ' +
    'have has had do did done shall should may might can could out up down over ' +
    'about also very just only own same too now'
  ).split(' '),
);

/** Light suffix stemming to fold archaic inflection (goeth→go, knoweth→know). */
function stem(word: string): string {
  for (const suffix of ['eth', 'est', 'ing', 'edly', 'ed', 'es', 's']) {
    if (word.length >= suffix.length + 2 && word.endsWith(suffix)) {
      return word.slice(0, word.length - suffix.length);
    }
  }
  return word;
}

/** Lowercase alphabetic words of a translation, in order (punctuation dropped). */
export function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** The set of significant word-stems used to compare editions of one verse. */
export function significantStems(text: string): Set<string> {
  const out = new Set<string>();
  for (const w of words(text)) {
    if (!STOPWORDS.has(w)) out.add(stem(w));
  }
  return out;
}

/** Jaccard similarity of two stem sets. Two empty sets are treated as identical. */
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 1 : inter / union;
}

/** Below this minimum pairwise Jaccard, a verse is flagged materially divergent. */
export const DIVERGENCE_THRESHOLD = 0.4;

export interface EditionText {
  editionId: string;
  text: string;
}

export interface DivergencePair {
  a: string;
  b: string;
  jaccard: number;
}

export interface DivergenceResult {
  /** Minimum pairwise Jaccard across editions (1 when fewer than two editions). */
  minJaccard: number;
  /** True when minJaccard < threshold. */
  divergent: boolean;
  threshold: number;
  /** Every edition pair with its similarity, most divergent first. */
  pairs: DivergencePair[];
  /** How many editions were compared. Divergence needs at least two. */
  editionCount: number;
}

/**
 * Compute lexical divergence for one verse across editions.
 *
 * Method (documented for the reader on /compare): each edition's translation is
 * lowercased, stripped of punctuation and stopwords, and light-stemmed to a set of
 * significant word-stems. We take the minimum pairwise Jaccard similarity across
 * editions; the verse is "materially divergent" when that minimum is below
 * `threshold`. This is a lexical measure — it captures both substantive and
 * stylistic difference — so the per-pair score is always exposed for the reader to
 * judge. It is deterministic and hand-curates nothing.
 */
export function computeDivergence(
  editions: EditionText[],
  threshold: number = DIVERGENCE_THRESHOLD,
): DivergenceResult {
  const stems = editions.map((e) => ({ id: e.editionId, set: significantStems(e.text) }));
  const pairs: DivergencePair[] = [];
  let minJaccard = 1;
  for (let i = 0; i < stems.length; i++) {
    for (let j = i + 1; j < stems.length; j++) {
      const score = jaccard(stems[i]!.set, stems[j]!.set);
      pairs.push({ a: stems[i]!.id, b: stems[j]!.id, jaccard: score });
      if (score < minJaccard) minJaccard = score;
    }
  }
  pairs.sort((x, y) => x.jaccard - y.jaccard);
  return {
    minJaccard,
    divergent: editions.length >= 2 && minJaccard < threshold,
    threshold,
    pairs,
    editionCount: editions.length,
  };
}

export interface EditionVerses {
  editionId: string;
  /** verse id → translation text. */
  byVerseId: Map<string, string>;
}

export interface ReverseLookupVerse {
  verseId: string;
  /** Editions whose rendering of this verse contains the query word. */
  editionIds: string[];
}

export interface ReverseLookupResult {
  /** The normalised query word actually matched (lowercased, alphabetic). */
  word: string;
  /** Verses whose translation renders the word, in verse-id order of appearance. */
  verses: ReverseLookupVerse[];
  /** Total verse count, for display. */
  total: number;
}

/**
 * Reverse lookup: given an English word, find the verses whose translation renders
 * it, in any edition. Whole-word, case-insensitive, punctuation-insensitive match
 * against each edition's verse text.
 *
 * This is deliberately verse-level: it reports which *verses* use the word, not
 * which Arabic word corresponds to it — no word-level alignment data exists for
 * these editions, and the UI says so. The Arabic tokens of a matched verse are
 * joined in by the caller from the corpus; this function only finds the verses.
 */
export function reverseLookup(
  query: string,
  editions: EditionVerses[],
  verseOrder: string[],
): ReverseLookupResult {
  const normalised = words(query)[0] ?? '';
  const hits = new Map<string, Set<string>>();
  if (normalised) {
    for (const edition of editions) {
      for (const [verseId, text] of edition.byVerseId) {
        if (words(text).includes(normalised)) {
          let set = hits.get(verseId);
          if (!set) {
            set = new Set<string>();
            hits.set(verseId, set);
          }
          set.add(edition.editionId);
        }
      }
    }
  }
  const orderIndex = new Map(verseOrder.map((id, i) => [id, i]));
  const verses: ReverseLookupVerse[] = [...hits.entries()]
    .map(([verseId, editionIds]) => ({ verseId, editionIds: [...editionIds] }))
    .sort((a, b) => (orderIndex.get(a.verseId) ?? 0) - (orderIndex.get(b.verseId) ?? 0));
  return { word: normalised, verses, total: verses.length };
}
