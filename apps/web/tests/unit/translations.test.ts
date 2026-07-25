import { describe, expect, it } from 'vitest';

import {
  computeDivergence,
  DIVERGENCE_THRESHOLD,
  jaccard,
  reverseLookup,
  significantStems,
  words,
} from '@/lib/translations';

describe('significantStems', () => {
  it('drops stopwords and folds archaic inflection', () => {
    const set = significantStems('But lo! with hardship goeth ease');
    // "but", "lo", "with" are stopwords; "goeth" stems to "go".
    expect([...set].sort()).toEqual(['ease', 'go', 'hardship']);
  });

  it('is punctuation-insensitive', () => {
    expect(significantStems('Mercy, mercy!')).toEqual(new Set(['mercy']));
  });
});

describe('jaccard', () => {
  it('is 1 for identical stem sets and 0 for disjoint', () => {
    expect(jaccard(new Set(['a', 'b']), new Set(['a', 'b']))).toBe(1);
    expect(jaccard(new Set(['a']), new Set(['b']))).toBe(0);
    expect(jaccard(new Set(), new Set())).toBe(1);
  });
});

describe('computeDivergence', () => {
  it('flags a verse the editions render very differently (94:5)', () => {
    // Real public-domain renderings of the same verse.
    const result = computeDivergence([
      { editionId: 'en-pickthall', text: 'But lo! with hardship goeth ease,' },
      { editionId: 'en-rodwell', text: 'Then verily along with trouble cometh ease.' },
    ]);
    expect(result.divergent).toBe(true);
    expect(result.minJaccard).toBeLessThan(DIVERGENCE_THRESHOLD);
    expect(result.editionCount).toBe(2);
  });

  it('does not flag a verse where the editions agree', () => {
    const result = computeDivergence([
      { editionId: 'en-pickthall', text: 'Say: He is Allah, the One!' },
      { editionId: 'en-rodwell', text: 'Say: He is God alone, the One.' },
    ]);
    // Shared significant stems (say, allah/god vary but "one" + "say" carry).
    expect(result.minJaccard).toBeGreaterThanOrEqual(DIVERGENCE_THRESHOLD);
    expect(result.divergent).toBe(false);
  });

  it('never flags divergence with fewer than two editions', () => {
    const result = computeDivergence([{ editionId: 'en-pickthall', text: 'anything' }]);
    expect(result.divergent).toBe(false);
    expect(result.minJaccard).toBe(1);
  });

  it('exposes a score for every edition pair, most divergent first', () => {
    const result = computeDivergence([
      { editionId: 'a', text: 'the merciful lord' },
      { editionId: 'b', text: 'the merciful lord' },
      { editionId: 'c', text: 'a completely different sentence entirely' },
    ]);
    expect(result.pairs).toHaveLength(3);
    expect(result.pairs[0]!.jaccard).toBeLessThanOrEqual(result.pairs[2]!.jaccard);
  });
});

describe('reverseLookup', () => {
  const editions = [
    {
      editionId: 'en-pickthall',
      byVerseId: new Map([
        ['q:1:1', 'In the name of Allah, the Beneficent, the Merciful.'],
        ['q:1:3', 'The Beneficent, the Merciful.'],
        ['q:2:2', 'This is the Scripture whereof there is no doubt.'],
      ]),
    },
    {
      editionId: 'en-rodwell',
      byVerseId: new Map([
        ['q:1:1', 'In the Name of God, the Compassionate, the Merciful.'],
        ['q:1:3', 'The Compassionate, the Merciful.'],
        ['q:2:2', 'No doubt is there about this Book.'],
      ]),
    },
  ];
  const order = ['q:1:1', 'q:1:3', 'q:2:2'];

  it('finds verses whose translation renders the word, in verse order', () => {
    const r = reverseLookup('merciful', editions, order);
    expect(r.word).toBe('merciful');
    expect(r.verses.map((v) => v.verseId)).toEqual(['q:1:1', 'q:1:3']);
    expect(r.total).toBe(2);
  });

  it('records which editions matched a verse', () => {
    const r = reverseLookup('beneficent', editions, order);
    // Only Pickthall uses "beneficent"; Rodwell uses "compassionate".
    expect(r.verses.map((v) => v.verseId)).toEqual(['q:1:1', 'q:1:3']);
    for (const v of r.verses) expect(v.editionIds).toEqual(['en-pickthall']);
  });

  it('matches whole words only and is case-insensitive', () => {
    expect(reverseLookup('Doubt', editions, order).verses.map((v) => v.verseId)).toEqual(['q:2:2']);
    // "name" must not match inside another word.
    expect(reverseLookup('ame', editions, order).total).toBe(0);
  });

  it('returns nothing for an empty query', () => {
    expect(reverseLookup('   ', editions, order).total).toBe(0);
  });
});

describe('words', () => {
  it('lowercases and splits on non-alpha', () => {
    expect(words("God's Mercy!")).toEqual(['god', 's', 'mercy']);
  });
});
