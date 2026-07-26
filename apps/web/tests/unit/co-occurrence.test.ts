import { describe, expect, it } from 'vitest';

import { rankCoOccurrence, tallyCoOccurrence } from '@/lib/co-occurrence';

describe('co-occurrence', () => {
  // Subject root 'salah' appears in three verses; the sets are the roots in each.
  const versesContainingTarget = [
    new Set(['salah', 'zakah', 'allah']),
    new Set(['salah', 'zakah']),
    new Set(['salah', 'patience', 'allah']),
  ];
  // 'allah' is ubiquitous and excluded from results.
  const exclude = new Set(['allah']);

  it('tallies distinct shared verses and excludes the subject and stoplist', () => {
    const tally = tallyCoOccurrence('salah', versesContainingTarget, exclude);
    expect(tally.get('zakah')).toBe(2);
    expect(tally.get('patience')).toBe(1);
    expect(tally.has('salah')).toBe(false); // subject dropped
    expect(tally.has('allah')).toBe(false); // ubiquitous dropped
  });

  it('ranks by shared-verse count, deterministic on ties', () => {
    const tally = tallyCoOccurrence('salah', versesContainingTarget, exclude);
    const ranked = rankCoOccurrence(tally, 10);
    expect(ranked.map((r) => r.rootSlug)).toEqual(['zakah', 'patience']);
    expect(ranked[0]!.sharedVerses).toBe(2);
  });

  it('is stable and reproducible across runs', () => {
    const a = rankCoOccurrence(
      tallyCoOccurrence('salah', versesContainingTarget, exclude),
      10,
    );
    const b = rankCoOccurrence(
      tallyCoOccurrence('salah', versesContainingTarget, exclude),
      10,
    );
    expect(a).toEqual(b);
  });
});
