import { describe, expect, it } from 'vitest';

import { glossKey, glossSlug, groupGloss, type GlossItem } from '@/lib/gloss';

describe('glossKey', () => {
  it('folds case, collapses whitespace and unifies apostrophes', () => {
    expect(glossKey('  The   Mercy ')).toBe('the mercy');
    expect(glossKey('Lord’s')).toBe("lord's");
    expect(glossKey("Lord's")).toBe("lord's");
  });

  it('folds punctuation and bracket variants of one word to a single key', () => {
    const variants = ['the zakah', 'the zakah,', 'the zakah."', '[the] zakah.'];
    const keys = new Set(variants.map(glossKey));
    expect(keys).toEqual(new Set(['the zakah']));
  });

  it('keeps bracketed helper text but drops the delimiters', () => {
    expect(glossKey('(the) reward')).toBe('the reward');
    expect(glossKey('reward.')).toBe('reward');
    expect(glossKey('"reward"')).toBe('reward');
  });
});

describe('glossSlug', () => {
  it('turns spaces into hyphens', () => {
    expect(glossSlug('the zakah')).toBe('the-zakah');
    expect(glossSlug('reward')).toBe('reward');
  });
});

describe('groupGloss', () => {
  // A hand-checked gloss: five tokens across three roots (one with no root),
  // two lemmas under the busiest root.
  const items: GlossItem<string>[] = [
    { rootSlug: 'r-hh-m', root: 'ر ح م', lemma: 'رَحْمَة', ref: 'a' },
    { rootSlug: 'r-hh-m', root: 'ر ح م', lemma: 'رَحْمَة', ref: 'b' },
    { rootSlug: 'r-hh-m', root: 'ر ح م', lemma: 'رَحِيم', ref: 'c' },
    { rootSlug: 'gh-f-r', root: 'غ ف ر', lemma: 'غَفُور', ref: 'd' },
    { rootSlug: null, root: null, lemma: null, ref: 'e' },
  ];

  it('groups by root then lemma with counts', () => {
    const g = groupGloss(items);
    expect(g.total).toBe(5);
    expect(g.rootCount).toBe(3);

    // Busiest root first, no-root bucket last.
    expect(g.groups.map((x) => x.rootSlug)).toEqual(['r-hh-m', 'gh-f-r', null]);
    expect(g.groups[0]!.count).toBe(3);

    // Lemmas within the root are ordered by count.
    const lemmas = g.groups[0]!.lemmas;
    expect(lemmas.map((l) => l.lemma)).toEqual(['رَحْمَة', 'رَحِيم']);
    expect(lemmas[0]!.count).toBe(2);
    expect(lemmas[0]!.refs).toEqual(['a', 'b']);
  });

  it('is deterministic regardless of input order', () => {
    const a = groupGloss(items);
    const b = groupGloss([...items].reverse());
    expect(b.groups.map((x) => x.rootSlug)).toEqual(
      a.groups.map((x) => x.rootSlug),
    );
  });
});
