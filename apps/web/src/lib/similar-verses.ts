// Similar verses, ranked by shared roots (workplan item 12).
//
// Measure: the Jaccard index over each verse's set of morphological roots,
//   J(A, B) = |A ∩ B| / |A ∪ B|,
// after removing a documented stoplist of ubiquitous roots. Jaccard is symmetric,
// bounded in [0, 1], and — unlike a raw shared-root count — is not inflated by long
// verses, so a two-root verse and a forty-root verse are compared on the same
// footing. The stoplist matters because a handful of roots (Allah, say, be, lord …)
// occur in a large fraction of verses; left in, they make almost every verse look
// similar to every other and drown the real signal. See /method for the exact list.
//
// Pure functions: the caller supplies the already-stoplisted root sets, so this
// module is tested with fixtures and knows nothing of the corpus.

export interface SimilarCandidate {
  verseId: string;
  roots: ReadonlySet<string>;
}

export interface SimilarVerse {
  verseId: string;
  /** Roots shared with the target (stoplist already removed), for display. */
  shared: string[];
  score: number;
  intersection: number;
  union: number;
}

/** Jaccard index of two sets. Empty ∪ empty is defined as 0 (no shared signal). */
export function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const x of small) if (large.has(x)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Rank candidate verses by Jaccard similarity to the target root set, most similar
 * first. Ties break on the larger intersection, then on verse id, so the ordering
 * is deterministic and reproducible. Verses sharing no root score 0 and are
 * dropped. `limit` caps the returned list.
 */
export function rankSimilarVerses(
  targetRoots: ReadonlySet<string>,
  candidates: Iterable<SimilarCandidate>,
  limit: number,
): SimilarVerse[] {
  const scored: SimilarVerse[] = [];
  for (const candidate of candidates) {
    let intersection = 0;
    const shared: string[] = [];
    const [small, large] =
      targetRoots.size <= candidate.roots.size
        ? [targetRoots, candidate.roots]
        : [candidate.roots, targetRoots];
    for (const root of small)
      if (large.has(root)) {
        intersection += 1;
        shared.push(root);
      }
    if (intersection === 0) continue;
    const union = targetRoots.size + candidate.roots.size - intersection;
    scored.push({
      verseId: candidate.verseId,
      shared,
      score: union === 0 ? 0 : intersection / union,
      intersection,
      union,
    });
  }
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      b.intersection - a.intersection ||
      (a.verseId < b.verseId ? -1 : a.verseId > b.verseId ? 1 : 0),
  );
  return scored.slice(0, limit);
}
