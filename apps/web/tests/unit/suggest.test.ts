import { describe, expect, it } from 'vitest';

import { suggest } from '@/server/suggest';

// Exercises the autosuggest against the real corpus index — same pattern as
// api-core.test.ts. The dropdown is an enhancement, but a wrong suggestion is
// worse than none: each source (surah, verse ref, root, word, gloss) gets a
// case pinning the behaviour that matters.

describe('suggest', () => {
  it('returns nothing for empty or absurd input', () => {
    expect(suggest('')).toEqual([]);
    expect(suggest('   ')).toEqual([]);
    expect(suggest('x'.repeat(80))).toEqual([]);
    expect(suggest('zzzzqqqq')).toEqual([]);
  });

  it('suggests a surah by transliterated name prefix', () => {
    const out = suggest('fati');
    const surah = out.find((s) => s.type === 'surah');
    expect(surah).toBeDefined();
    expect(surah!.href).toBe('/1');
    expect(surah!.label).toContain('Faati'); // Tanzil spells it Al-Faatiha
  });

  it('suggests a surah by English name', () => {
    const out = suggest('the opening');
    expect(out.some((s) => s.type === 'surah' && s.href === '/1')).toBe(true);
  });

  it('turns a verse reference into direct navigation', () => {
    const out = suggest('2:255');
    expect(out[0]).toMatchObject({ type: 'verse', href: '/2#255' });
  });

  it('rejects a verse reference to a surah that does not exist', () => {
    expect(suggest('115:1').some((s) => s.type === 'verse')).toBe(false);
  });

  it('suggests a root from spaceless Arabic input', () => {
    const out = suggest('زكو');
    const root = out.find((s) => s.type === 'root');
    expect(root).toBeDefined();
    expect(root!.href).toMatch(/^\/root\//);
    expect(root!.label).toContain('ز ك و');
  });

  it('suggests Arabic word forms ranked by frequency, filling the query', () => {
    const out = suggest('الل');
    const words = out.filter((s) => s.type === 'word');
    expect(words.length).toBeGreaterThan(0);
    // Every word suggestion fills the search box rather than navigating.
    for (const w of words) {
      expect(w.q).toBeTruthy();
      expect(w.href).toBeUndefined();
    }
    // Frequency order: the first word suggestion is at least as common as the last.
    const count = (s: { detail: string }) =>
      Number(s.detail.replace(/[^0-9]/g, ''));
    expect(count(words[0]!)).toBeGreaterThanOrEqual(count(words[words.length - 1]!));
  });

  it('suggests English glosses linking to the reverse lookup', () => {
    const out = suggest('mercy');
    const gloss = out.find((s) => s.type === 'gloss');
    expect(gloss).toBeDefined();
    expect(gloss!.href).toMatch(/^\/gloss\//);
  });

  it('never returns more than eight suggestions', () => {
    for (const q of ['a', 'al', 'the', 'ال', 'م']) {
      expect(suggest(q).length).toBeLessThanOrEqual(8);
    }
  });
});
