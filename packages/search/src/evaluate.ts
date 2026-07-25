import type { HandleRange, SearchIndex } from './build-index.js';
import { canonicaliseUthmani, normaliseArabic } from './normalise.js';
import { resolveReference } from './reference.js';
import type { Query, Scope } from './types.js';

/**
 * Resolve a `root:` input to the spaced-Arabic key the root index is built on.
 * Accepts the slug (`z-k-w`), the spaced form (`ز ك و`), or the unspaced form
 * (`زكو`). A slug is ASCII, so it never collides with an Arabic root.
 */
function rootKey(index: SearchIndex, input: string): string | undefined {
  const s = input.trim();
  if (/^[a-z0-9-]+$/i.test(s)) return index.rootBySlug.get(s.toLowerCase());
  const letters = [...s].filter((ch) => !/\s/.test(ch));
  return letters.length ? letters.join(' ') : undefined;
}

// The evaluator. Every query reduces to a sorted, duplicate-free list of token
// handles (integer indices into index.tokens). Working in sorted handle space —
// not sets — is what keeps the whole surface fast: the posting lists are already
// in ascending corpus order, so the terminal queries are zero-copy, set algebra
// is a linear merge, and the caller never has to sort. A `pos:V` match of ~19k
// handles then costs a merge, not a 19k-element Set construction plus a re-sort.
//
// All postings in the index are built by pushing handles as i increases, so
// every posting list is already sorted ascending and unique. Every operation
// here preserves that invariant, so results compose without an intermediate sort.

/** Intersect two sorted, unique handle lists. */
function intersectSorted(a: number[], b: number[]): number[] {
  const out: number[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const x = a[i]!;
    const y = b[j]!;
    if (x === y) {
      out.push(x);
      i++;
      j++;
    } else if (x < y) i++;
    else j++;
  }
  return out;
}

/** Union of two sorted, unique handle lists. */
function unionSorted(a: number[], b: number[]): number[] {
  const out: number[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const x = a[i]!;
    const y = b[j]!;
    if (x === y) {
      out.push(x);
      i++;
      j++;
    } else if (x < y) {
      out.push(x);
      i++;
    } else {
      out.push(y);
      j++;
    }
  }
  while (i < a.length) out.push(a[i++]!);
  while (j < b.length) out.push(b[j++]!);
  return out;
}

/**
 * Union of many sorted, unique handle lists. A balanced pairwise merge (log k
 * passes, each linear in the total) — not a running fold — so a suffix or
 * pattern query that matches hundreds of keys never re-copies a growing
 * accumulator once per key.
 */
function unionSortedMany(lists: number[][]): number[] {
  if (lists.length === 0) return [];
  let level = lists;
  while (level.length > 1) {
    const next: number[][] = [];
    for (let i = 0; i < level.length; i += 2) {
      next.push(i + 1 < level.length ? unionSorted(level[i]!, level[i + 1]!) : level[i]!);
    }
    level = next;
  }
  return level[0]!;
}

/** Set difference a \ b over sorted, unique handle lists. */
function differenceSorted(a: number[], b: number[]): number[] {
  const out: number[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length) {
    if (j >= b.length) {
      out.push(a[i]!);
      i++;
      continue;
    }
    const x = a[i]!;
    const y = b[j]!;
    if (x === y) {
      i++;
      j++;
    } else if (x < y) {
      out.push(x);
      i++;
    } else j++;
  }
  return out;
}

/** The whole corpus, [0, n), minus a sorted, unique exclusion list. */
function complement(n: number, excluded: number[]): number[] {
  const out: number[] = [];
  let j = 0;
  for (let h = 0; h < n; h++) {
    if (j < excluded.length && excluded[j] === h) {
      j++;
      continue;
    }
    out.push(h);
  }
  return out;
}

/** The whole corpus as a sorted handle list. */
function allHandles(n: number): number[] {
  const out = new Array<number>(n);
  for (let h = 0; h < n; h++) out[h] = h;
  return out;
}

function patternToRegExp(pattern: string): RegExp {
  let src = '^';
  for (const ch of pattern) {
    if (ch === '*') src += '.*';
    else if (ch === '?') src += '.';
    else src += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  src += '$';
  return new RegExp(src);
}

/** Union the postings of every matching key into one sorted, unique list. */
function unionPostings(index: SearchIndex, keys: string[]): number[] {
  const lists: number[][] = [];
  for (const key of keys) {
    const postings = index.normalised.get(key);
    if (postings) lists.push(postings);
  }
  return unionSortedMany(lists);
}

// Scope resolution is set intersection over contiguous handle ranges, never a
// scan of the corpus. A scope becomes a small, sorted, disjoint list of
// half-open intervals; a scoped query then touches only handles inside them.

/** Merge a list of ranges into sorted, disjoint intervals. Mutates nothing. */
function mergeRanges(ranges: HandleRange[]): HandleRange[] {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const out: HandleRange[] = [{ start: sorted[0]!.start, end: sorted[0]!.end }];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i]!;
    const last = out[out.length - 1]!;
    if (cur.start <= last.end) last.end = Math.max(last.end, cur.end);
    else out.push({ start: cur.start, end: cur.end });
  }
  return out;
}

/** Intersect two sorted, disjoint interval lists. */
function intersectRanges(a: HandleRange[], b: HandleRange[]): HandleRange[] {
  const out: HandleRange[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const start = Math.max(a[i]!.start, b[j]!.start);
    const end = Math.min(a[i]!.end, b[j]!.end);
    if (start < end) out.push({ start, end });
    if (a[i]!.end < b[j]!.end) i++;
    else j++;
  }
  return out;
}

function surahIntervals(index: SearchIndex, surahs: number[]): HandleRange[] {
  const ranges: HandleRange[] = [];
  for (const s of surahs) {
    const r = index.surahRange.get(s);
    if (r) ranges.push(r);
  }
  return mergeRanges(ranges);
}

function segmentRangeIntervals(
  index: SearchIndex,
  range: { surah: number; from: number; to: number },
): HandleRange[] {
  const bySurah = index.refIndex.get(range.surah);
  if (!bySurah) return [];
  const ranges: HandleRange[] = [];
  for (let ordinal = range.from; ordinal <= range.to; ordinal++) {
    const segment = bySurah.get(ordinal);
    if (!segment) continue;
    const r = index.segmentRange.get(segment.id);
    if (r) ranges.push(r);
  }
  return mergeRanges(ranges);
}

/**
 * Resolve a scope to sorted, disjoint handle intervals. Multiple constraints
 * intersect (both must hold), matching the whitelist semantics of the previous
 * per-token check. An empty scope constrains nothing — the whole corpus.
 */
function scopeIntervals(index: SearchIndex, scope: Scope): HandleRange[] {
  let intervals: HandleRange[] | undefined;
  if (scope.surahs) {
    intervals = surahIntervals(index, scope.surahs);
  }
  if (scope.segmentRange) {
    const seg = segmentRangeIntervals(index, scope.segmentRange);
    intervals = intervals === undefined ? seg : intersectRanges(intervals, seg);
  }
  return intervals ?? [{ start: 0, end: index.tokens.length }];
}

/** Membership test over sorted, disjoint intervals by binary search. */
function inIntervals(intervals: HandleRange[], handle: number): boolean {
  let lo = 0;
  let hi = intervals.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const iv = intervals[mid]!;
    if (handle < iv.start) hi = mid - 1;
    else if (handle >= iv.end) lo = mid + 1;
    else return true;
  }
  return false;
}

/** Materialise sorted, disjoint intervals to a sorted handle list. */
function intervalsToHandles(intervals: HandleRange[]): number[] {
  const out: number[] = [];
  for (const iv of intervals) for (let h = iv.start; h < iv.end; h++) out.push(h);
  return out;
}

function proximityJoin(
  index: SearchIndex,
  a: number[],
  b: number[],
  distance: number,
  crossSegment: boolean,
): number[] {
  const out = new Set<number>();
  let lo = 0;
  for (const y of b) {
    while (lo < a.length && a[lo]! < y - distance) lo++;
    let k = lo;
    let paired = false;
    while (k < a.length && a[k]! <= y + distance) {
      const x = a[k]!;
      if (x !== y && (crossSegment || index.segmentIdOf[x] === index.segmentIdOf[y])) {
        out.add(x);
        paired = true;
      }
      k++;
    }
    if (paired) out.add(y);
  }
  return [...out].sort((p, q) => p - q);
}

function adjacencyJoin(index: SearchIndex, left: number[], right: number[]): number[] {
  const leftSet = new Set(left);
  const out = new Set<number>();
  for (const r of right) {
    const l = r - 1;
    if (l >= 0 && leftSet.has(l) && index.segmentIdOf[l] === index.segmentIdOf[r]) {
      out.add(l);
      out.add(r);
    }
  }
  return [...out].sort((p, q) => p - q);
}

/**
 * Evaluate a query to a sorted, duplicate-free list of matching token handles.
 * Every branch returns handles in ascending order, so the caller never sorts and
 * set algebra composes by linear merge. Terminal posting lists are returned by
 * reference and must be treated as read-only.
 */
export function evaluateHandles(index: SearchIndex, query: Query): number[] {
  switch (query.type) {
    case 'exact': {
      return index.exact.get(canonicaliseUthmani(query.text)) ?? [];
    }
    case 'normalised': {
      return index.normalised.get(normaliseArabic(query.text)) ?? [];
    }
    case 'prefix': {
      const needle = normaliseArabic(query.text);
      const keys: string[] = [];
      for (const key of index.normalised.keys()) if (key.startsWith(needle)) keys.push(key);
      return unionPostings(index, keys);
    }
    case 'suffix': {
      const needle = normaliseArabic(query.text);
      const keys: string[] = [];
      for (const key of index.normalised.keys()) if (key.endsWith(needle)) keys.push(key);
      return unionPostings(index, keys);
    }
    case 'pattern': {
      const re = patternToRegExp(normaliseArabic(query.pattern));
      const keys: string[] = [];
      for (const key of index.normalised.keys()) if (re.test(key)) keys.push(key);
      return unionPostings(index, keys);
    }
    case 'proximity': {
      const a = evaluateHandles(index, query.left);
      const b = evaluateHandles(index, query.right);
      return proximityJoin(index, a, b, query.distance, query.crossSegment ?? false);
    }
    case 'adjacency': {
      const left = evaluateHandles(index, query.left);
      const right = evaluateHandles(index, query.right);
      return adjacencyJoin(index, left, right);
    }
    case 'and': {
      if (query.clauses.length === 0) return [];
      // `A AND NOT B` is the set difference A \ B. Evaluating NOT on its own
      // materialises the whole-corpus complement of B (O(n)); folding it into
      // the AND as an exclusion avoids that — the negated clause is evaluated
      // directly and its members removed. Positive clauses still intersect
      // smallest-first, which minimises the size carried through the fold.
      const positives: Query[] = [];
      const negatives: Query[] = [];
      for (const c of query.clauses) {
        if (c.type === 'not') negatives.push(c.clause);
        else positives.push(c);
      }

      let base: number[];
      if (positives.length > 0) {
        const lists = positives
          .map((c) => evaluateHandles(index, c))
          .sort((x, y) => x.length - y.length);
        base = lists[0]!;
        for (let k = 1; k < lists.length && base.length > 0; k++) {
          base = intersectSorted(base, lists[k]!);
        }
      } else {
        // Only negated clauses: the base is the whole corpus (unavoidably O(n)).
        base = allHandles(index.tokens.length);
      }

      if (negatives.length === 0) return base;
      const excluded = unionSortedMany(negatives.map((neg) => evaluateHandles(index, neg)));
      return differenceSorted(base, excluded);
    }
    case 'or': {
      return unionSortedMany(query.clauses.map((clause) => evaluateHandles(index, clause)));
    }
    case 'not': {
      const excluded = evaluateHandles(index, query.clause);
      return complement(index.tokens.length, excluded);
    }
    case 'scoped': {
      const intervals = scopeIntervals(index, query.scope);
      // A bare scope (`surah:2`) has an `all` inner: materialise the intervals
      // directly, in order, never touching a handle outside the scope.
      if (query.query.type === 'all') return intervalsToHandles(intervals);
      const inner = evaluateHandles(index, query.query);
      const out: number[] = [];
      for (const h of inner) if (inIntervals(intervals, h)) out.push(h);
      return out;
    }
    case 'all': {
      return allHandles(index.tokens.length);
    }
    case 'reference': {
      const segments = resolveReference(index, query.ref) ?? [];
      const lists: number[][] = [];
      for (const segment of segments) {
        const handles = index.segmentTokens.get(segment.id);
        if (handles) lists.push(handles);
      }
      return unionSortedMany(lists);
    }
    case 'root': {
      const key = rootKey(index, query.root);
      return (key === undefined ? undefined : index.root.get(key)) ?? [];
    }
    case 'lemma': {
      const exactPostings = index.lemma.get(query.lemma);
      if (exactPostings) return exactPostings;
      return index.lemmaNormalised.get(normaliseArabic(query.lemma)) ?? [];
    }
    case 'pos': {
      return index.pos.get(query.pos) ?? [];
    }
  }
}

/**
 * Evaluate a query to the set of matching token handles. Thin wrapper over
 * {@link evaluateHandles} for callers that want a Set; the handle list it wraps
 * is already sorted and unique.
 */
export function evaluate(index: SearchIndex, query: Query): Set<number> {
  return new Set(evaluateHandles(index, query));
}
