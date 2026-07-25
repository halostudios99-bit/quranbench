import type { HandleRange, SearchIndex } from './build-index.js';
import { canonicaliseUthmani, normaliseArabic } from './normalise.js';
import { resolveReference } from './reference.js';
import { UnsupportedQueryError, type Query, type Scope } from './types.js';

// The evaluator. Every query reduces to a set of token handles (integer indices
// into index.tokens). Set algebra composes booleans; positional joins over
// sorted handle lists give proximity and adjacency without scanning the corpus.

function sorted(set: Set<number>): number[] {
  return [...set].sort((a, b) => a - b);
}

function unionPostings(index: SearchIndex, keys: Iterable<string>): Set<number> {
  const out = new Set<number>();
  for (const key of keys) {
    const postings = index.normalised.get(key);
    if (postings) for (const h of postings) out.add(h);
  }
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

function proximityJoin(
  index: SearchIndex,
  a: number[],
  b: number[],
  distance: number,
  crossSegment: boolean,
): Set<number> {
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
  return out;
}

function adjacencyJoin(index: SearchIndex, left: Set<number>, right: number[]): Set<number> {
  const out = new Set<number>();
  for (const r of right) {
    const l = r - 1;
    if (l >= 0 && left.has(l) && index.segmentIdOf[l] === index.segmentIdOf[r]) {
      out.add(l);
      out.add(r);
    }
  }
  return out;
}

/** Evaluate a query to the set of matching token handles. */
export function evaluate(index: SearchIndex, query: Query): Set<number> {
  switch (query.type) {
    case 'exact': {
      const postings = index.exact.get(canonicaliseUthmani(query.text));
      return new Set(postings ?? []);
    }
    case 'normalised': {
      const postings = index.normalised.get(normaliseArabic(query.text));
      return new Set(postings ?? []);
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
      const a = sorted(evaluate(index, query.left));
      const b = sorted(evaluate(index, query.right));
      return proximityJoin(index, a, b, query.distance, query.crossSegment ?? false);
    }
    case 'adjacency': {
      const left = evaluate(index, query.left);
      const right = sorted(evaluate(index, query.right));
      return adjacencyJoin(index, left, right);
    }
    case 'and': {
      if (query.clauses.length === 0) return new Set();
      // `A AND NOT B` is the set difference A \ B. Evaluating NOT on its own
      // materialises the whole-corpus complement of B (O(n)); folding it into
      // the AND as an exclusion avoids that — the negated clause is evaluated
      // directly and its members removed. Positive clauses still intersect
      // smallest-first.
      const positives: Query[] = [];
      const negatives: Query[] = [];
      for (const c of query.clauses) {
        if (c.type === 'not') negatives.push(c.clause);
        else positives.push(c);
      }

      let base: Set<number>;
      if (positives.length > 0) {
        const sets = positives.map((c) => evaluate(index, c)).sort((x, y) => x.size - y.size);
        const [first, ...rest] = sets;
        base = new Set<number>();
        for (const h of first!) {
          if (rest.every((s) => s.has(h))) base.add(h);
        }
      } else {
        // Only negated clauses: the base is the whole corpus (unavoidably O(n)).
        base = new Set<number>();
        for (let i = 0; i < index.tokens.length; i++) base.add(i);
      }

      if (negatives.length === 0) return base;
      const excluded = new Set<number>();
      for (const neg of negatives) for (const h of evaluate(index, neg)) excluded.add(h);
      const out = new Set<number>();
      for (const h of base) if (!excluded.has(h)) out.add(h);
      return out;
    }
    case 'or': {
      const out = new Set<number>();
      for (const clause of query.clauses) {
        for (const h of evaluate(index, clause)) out.add(h);
      }
      return out;
    }
    case 'not': {
      const excluded = evaluate(index, query.clause);
      const out = new Set<number>();
      for (let i = 0; i < index.tokens.length; i++) if (!excluded.has(i)) out.add(i);
      return out;
    }
    case 'scoped': {
      const intervals = scopeIntervals(index, query.scope);
      const out = new Set<number>();
      // A bare scope (`surah:2`) has an `all` inner: materialise the intervals
      // directly, never touching a handle outside the scope.
      if (query.query.type === 'all') {
        for (const iv of intervals) for (let h = iv.start; h < iv.end; h++) out.add(h);
        return out;
      }
      const inner = evaluate(index, query.query);
      for (const h of inner) if (inIntervals(intervals, h)) out.add(h);
      return out;
    }
    case 'all': {
      const out = new Set<number>();
      for (let i = 0; i < index.tokens.length; i++) out.add(i);
      return out;
    }
    case 'reference': {
      const segments = resolveReference(index, query.ref) ?? [];
      const out = new Set<number>();
      for (const segment of segments) {
        const handles = index.segmentTokens.get(segment.id);
        if (handles) for (const h of handles) out.add(h);
      }
      return out;
    }
    case 'root':
    case 'lemma':
      throw new UnsupportedQueryError(query.type);
  }
}
