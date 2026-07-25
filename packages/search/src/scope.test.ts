import { loadCorpus } from '@quranbench/corpus';
import { beforeAll, describe, expect, it } from 'vitest';

import { buildIndex, type SearchIndex } from './build-index.js';
import { search } from './search.js';
import type { Query, Scope } from './types.js';

// Scope resolution moved from a per-token scan to a range intersection. These
// tests pin correctness against the *previous* scan-based semantics: an
// independent reference that reproduces the old per-token predicate, over a
// fixture of scoped queries, must agree with the optimised engine exactly.

let index: SearchIndex;

beforeAll(() => {
  index = buildIndex(loadCorpus());
});

/** The previous scan-based scope predicate, kept here as the reference oracle. */
function naiveInScope(id: string, scope: Scope): boolean {
  const handle = index.byId.get(id)!;
  const surah = index.tokens[handle]!.surah;
  if (scope.surahs && !scope.surahs.includes(surah)) return false;
  if (scope.segmentRange) {
    const range = scope.segmentRange;
    if (surah !== range.surah) return false;
    const segment = index.segmentById.get(index.segmentIdOf[handle]!);
    const ordinal = segment?.ordinals[index.activeScheme];
    if (ordinal === undefined || ordinal < range.from || ordinal > range.to) return false;
  }
  return true;
}

/** Reference: run the inner query, then post-filter by the naive predicate. */
function referenceScoped(scope: Scope, inner: Query): string[] {
  return search(index, inner).tokenIds.filter((id) => naiveInScope(id, scope));
}

const INNER: Array<[string, Query]> = [
  ['normalised الله', { type: 'normalised', text: 'الله' }],
  ['normalised الصلوة', { type: 'normalised', text: 'الصلوة' }],
  ['exact', { type: 'exact', text: 'ٱلزَّكَوٰةَ' }],
  ['prefix الص', { type: 'prefix', text: 'الص' }],
  ['suffix ون', { type: 'suffix', text: 'ون' }],
  ['pattern الرحم?', { type: 'pattern', pattern: 'الرحم?' }],
  ['all', { type: 'all' }],
  [
    'boolean (الرحمن OR الرحيم)',
    { type: 'or', clauses: [
      { type: 'normalised', text: 'الرحمن' },
      { type: 'normalised', text: 'الرحيم' },
    ] },
  ],
  [
    'adjacency واقيموا FOLLOWED_BY الصلوة',
    { type: 'adjacency', left: { type: 'normalised', text: 'واقيموا' }, right: { type: 'normalised', text: 'الصلوة' } },
  ],
];

const SCOPES: Array<[string, Scope]> = [
  ['surah 1', { surahs: [1] }],
  ['surah 2', { surahs: [2] }],
  ['surah 9 (no basmala)', { surahs: [9] }],
  ['surah 114', { surahs: [114] }],
  ['surahs 1,2', { surahs: [1, 2] }],
  ['surahs 2,3,4', { surahs: [2, 3, 4] }],
  ['segment 1:1-7', { segmentRange: { surah: 1, from: 1, to: 7 } }],
  ['segment 2:40-50', { segmentRange: { surah: 2, from: 40, to: 50 } }],
  ['segment 2:255', { segmentRange: { surah: 2, from: 255, to: 255 } }],
  ['segment 2:43-45', { segmentRange: { surah: 2, from: 43, to: 45 } }],
  ['segment 2:1-286', { segmentRange: { surah: 2, from: 1, to: 286 } }],
  ['segment 2:280-999 (over-range)', { segmentRange: { surah: 2, from: 280, to: 999 } }],
];

describe('scoped queries match the previous scan-based implementation', () => {
  // Every (scope, inner) pair is a fixture: 12 × 9 = 108, comfortably past the
  // 20-query floor. Each is checked against the naive reference, and the AND
  // form the parser actually emits (`surah:X AND term`) is checked too.
  const fixtures: Array<[string, Scope, Query]> = [];
  for (const [sLabel, scope] of SCOPES) {
    for (const [iLabel, inner] of INNER) {
      fixtures.push([`${sLabel} ∩ ${iLabel}`, scope, inner]);
    }
  }

  it(`covers at least 20 fixtures (has ${SCOPES.length * INNER.length})`, () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(20);
  });

  it.each(fixtures)('scoped node identical to reference: %s', (_label, scope, inner) => {
    const reference = referenceScoped(scope, inner);
    const scopedNode = search(index, { type: 'scoped', scope, query: inner }).tokenIds;
    expect(scopedNode).toEqual(reference);
  });

  it.each(fixtures)('AND-of-scoped-all identical to reference: %s', (_label, scope, inner) => {
    const reference = referenceScoped(scope, inner);
    const andForm = search(index, {
      type: 'and',
      clauses: [{ type: 'scoped', scope, query: { type: 'all' } }, inner],
    }).tokenIds;
    expect(andForm).toEqual(reference);
  });
});

describe('the reported defect', () => {
  it('surah:2 AND normalised:الصلوة returns the same 6 matches', () => {
    const r = search(index, {
      type: 'and',
      clauses: [
        { type: 'scoped', scope: { surahs: [2] }, query: { type: 'all' } },
        { type: 'normalised', text: 'الصلوة' },
      ],
    });
    expect(r.totalMatches).toBe(6);
    expect(r.tokenIds).toEqual([
      'quran:tanzil-uthmani:2:3:5',
      'quran:tanzil-uthmani:2:43:2',
      'quran:tanzil-uthmani:2:83:20',
      'quran:tanzil-uthmani:2:110:2',
      'quran:tanzil-uthmani:2:177:33',
      'quran:tanzil-uthmani:2:277:7',
    ]);
  });
});
