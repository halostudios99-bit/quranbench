// Root co-occurrence — the original brief's "connected concepts" (workplan item 13).
//
// Window: the verse. Two roots co-occur when they appear in the same counted verse.
// Measure: the number of distinct verses in which both roots occur. Raw shared-verse
// count is chosen over an association score (PMI and friends) because it is stable,
// needs no smoothing for rare roots, and reproduces exactly from the corpus — the
// property the tests and the reproducibility promise both need. The ubiquitous roots
// on the similarity stoplist are excluded from the *results* (not from the subject),
// so the list surfaces genuinely connected concepts rather than the same handful of
// function words under every root. The window and measure are stated on the page.
//
// Pure functions, tested with fixtures.

export interface CoOccurrence {
  rootSlug: string;
  sharedVerses: number;
}

/**
 * Tally, for a subject root, how many verses each other root shares with it.
 * `versesContainingTarget` is one root-slug set per verse that contains the subject.
 * `exclude` drops ubiquitous roots from the tally; the subject root is always
 * dropped from its own results.
 */
export function tallyCoOccurrence(
  targetSlug: string,
  versesContainingTarget: Iterable<ReadonlySet<string>>,
  exclude: ReadonlySet<string>,
): Map<string, number> {
  const tally = new Map<string, number>();
  for (const roots of versesContainingTarget) {
    for (const slug of roots) {
      if (slug === targetSlug || exclude.has(slug)) continue;
      tally.set(slug, (tally.get(slug) ?? 0) + 1);
    }
  }
  return tally;
}

/**
 * The most frequent co-occurring roots, highest count first. Ties break on the
 * root slug, so the result is deterministic. `limit` caps the list.
 */
export function rankCoOccurrence(
  tally: Map<string, number>,
  limit: number,
): CoOccurrence[] {
  return [...tally.entries()]
    .map(([rootSlug, sharedVerses]) => ({ rootSlug, sharedVerses }))
    .sort(
      (a, b) =>
        b.sharedVerses - a.sharedVerses ||
        (a.rootSlug < b.rootSlug ? -1 : a.rootSlug > b.rootSlug ? 1 : 0),
    )
    .slice(0, limit);
}
