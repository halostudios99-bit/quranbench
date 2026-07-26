import { describe, expect, it } from 'vitest';

import {
  describeGloss,
  getToken,
  listSimilarVerses,
  randomTokenId,
  rootCoOccurrences,
  similarityStoplist,
} from '@/server/corpus';

// Integration checks against the real, pinned corpus (v0.8.0). Each is a
// hand-checked worked example — a result a reader could reproduce by hand — so a
// regression in the measure or the index is caught, not just the plumbing.

describe('reverse gloss lookup', () => {
  it('groups the three Arabic roots rendered “reward”', () => {
    const view = describeGloss('reward');
    expect(view).toBeDefined();
    // ثوب, جزي and أجر are three distinct roots all glossed "reward".
    expect(view!.grouping.rootCount).toBe(3);
    const slugs = view!.grouping.groups.map((g) => g.rootSlug);
    expect(new Set(slugs)).toEqual(new Set(['th-w-b', 'j-z-y', 'e-j-r']));
    // The busiest root sorts first.
    expect(view!.grouping.groups[0]!.rootSlug).toBe('th-w-b');
  });

  it('is case- and space-insensitive on the query', () => {
    expect(describeGloss('  Reward ')?.key).toBe('reward');
  });
});

describe('similar verses', () => {
  it('ranks the establish-prayer / give-zakah verses highest for 2:43', () => {
    const result = listSimilarVerses('quran:tanzil-uthmani:2:43');
    expect(result.items.length).toBeGreaterThan(0);
    // 5:55 shares establish, prayer, zakah and bow — the strongest match.
    expect(result.items[0]!.ref).toBe('5:55');
    expect(result.items[0]!.score).toBeGreaterThan(0.6);
    // Every ranked verse genuinely shares a root; unrelated verses are dropped.
    for (const v of result.items) expect(v.shared.length).toBeGreaterThan(0);
  });
});

describe('root co-occurrence', () => {
  it('surfaces prayer and give as most connected to zakah', () => {
    const { items } = rootCoOccurrences('z-k-w');
    expect(items.length).toBeGreaterThan(0);
    const slugs = items.map((i) => i.slug);
    // صلو (prayer) and أتى (give/bring) co-occur with زكو most often.
    expect(slugs).toContain('sd-l-w');
    expect(slugs).toContain('e-t-y');
    // Ubiquitous roots are excluded from the results.
    const stop = new Set(similarityStoplist().map((r) => r.slug));
    for (const s of slugs) expect(stop.has(s)).toBe(false);
  });
});

describe('similarity stoplist', () => {
  it('is the eight most ubiquitous roots in v0.8.0', () => {
    const slugs = similarityStoplist().map((r) => r.slug);
    expect(slugs).toHaveLength(8);
    expect(slugs).toContain('e-l-h'); // Allah
  });
});

describe('random word', () => {
  it('resolves to a real token and is deterministic when seeded', () => {
    const id = randomTokenId('a-fixed-seed');
    expect(id).not.toBeNull();
    expect(getToken(id!)).toBeDefined();
    expect(randomTokenId('a-fixed-seed')).toBe(id);
  });

  it('returns a resolvable token when unseeded', () => {
    const id = randomTokenId(null);
    expect(id).not.toBeNull();
    expect(getToken(id!)).toBeDefined();
  });
});
