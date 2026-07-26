import { describe, expect, it } from 'vitest';

import {
  jaccard,
  rankSimilarVerses,
  type SimilarCandidate,
} from '@/lib/similar-verses';

describe('jaccard', () => {
  it('is intersection over union, symmetric and bounded', () => {
    const a = new Set(['x', 'y', 'z']);
    const b = new Set(['y', 'z', 'w']);
    // shared {y,z} = 2, union {x,y,z,w} = 4
    expect(jaccard(a, b)).toBeCloseTo(0.5);
    expect(jaccard(a, b)).toBe(jaccard(b, a));
    expect(jaccard(a, new Set())).toBe(0);
    expect(jaccard(a, a)).toBe(1);
  });
});

describe('rankSimilarVerses', () => {
  const target = new Set(['salah', 'zakah', 'faith']);
  const candidates: SimilarCandidate[] = [
    // Shares two of three roots — should rank highest.
    { verseId: 'strong', roots: new Set(['salah', 'zakah']) },
    // Shares one root but is diluted by many others — lower Jaccard.
    {
      verseId: 'weak',
      roots: new Set(['salah', 'a', 'b', 'c', 'd', 'e']),
    },
    // Shares nothing — must be dropped, not ranked.
    { verseId: 'unrelated', roots: new Set(['moon', 'star']) },
  ];

  it('ranks a verse sharing more roots above a diluted one, and drops unrelated', () => {
    const ranked = rankSimilarVerses(target, candidates, 10);
    expect(ranked.map((r) => r.verseId)).toEqual(['strong', 'weak']);
    expect(ranked.find((r) => r.verseId === 'unrelated')).toBeUndefined();
    expect(ranked[0]!.score).toBeGreaterThan(ranked[1]!.score);
    expect(ranked[0]!.shared.sort()).toEqual(['salah', 'zakah']);
  });

  it('respects the limit and is deterministic on ties', () => {
    const tied: SimilarCandidate[] = [
      { verseId: 'b', roots: new Set(['salah']) },
      { verseId: 'a', roots: new Set(['zakah']) },
    ];
    const ranked = rankSimilarVerses(target, tied, 1);
    expect(ranked).toHaveLength(1);
    // Equal score and intersection → tie broken by verse id ascending.
    expect(ranked[0]!.verseId).toBe('a');
  });
});
