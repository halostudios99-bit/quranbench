import { describe, expect, it } from 'vitest';

import { hashSeed, pickWordIndex } from '@/lib/random-word';

describe('random word picker', () => {
  it('is deterministic for a given seed', () => {
    expect(pickWordIndex('abc', 1000)).toBe(pickWordIndex('abc', 1000));
    expect(hashSeed('abc')).toBe(hashSeed('abc'));
  });

  it('different seeds generally pick different words', () => {
    expect(pickWordIndex('one', 77000)).not.toBe(pickWordIndex('two', 77000));
  });

  it('always returns an index in range', () => {
    for (const seed of ['a', 'zzz', '42', 'ٱلْحَمْدُ']) {
      const i = pickWordIndex(seed, 500);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(500);
    }
  });

  it('uses the injected RNG when unseeded, and stays in range at the boundary', () => {
    expect(pickWordIndex(null, 10, () => 0)).toBe(0);
    expect(pickWordIndex(null, 10, () => 0.999999)).toBe(9);
    // A pathological rnd() === 1 must not overflow the array.
    expect(pickWordIndex(null, 10, () => 1)).toBe(9);
  });

  it('returns -1 for an empty corpus', () => {
    expect(pickWordIndex('seed', 0)).toBe(-1);
    expect(pickWordIndex(null, 0)).toBe(-1);
  });
});
