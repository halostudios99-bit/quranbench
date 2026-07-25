import { describe, expect, it } from 'vitest';

import { parseQuery } from './parse.js';
import type { Query } from './types.js';

function ok(input: string): Query {
  const r = parseQuery(input);
  if (!r.ok) throw new Error(`expected parse to succeed: ${r.error.message}`);
  return r.query;
}

describe('parseQuery — well-formed', () => {
  it('quoted string → exact', () => {
    expect(ok('"ٱلزَّكَوٰةَ"')).toEqual({ type: 'exact', text: 'ٱلزَّكَوٰةَ' });
  });

  it('pattern field', () => {
    expect(ok('pattern:مف*ول')).toEqual({ type: 'pattern', pattern: 'مف*ول' });
  });

  it('bare word → normalised', () => {
    expect(ok('صلوة')).toEqual({ type: 'normalised', text: 'صلوة' });
  });

  it('prefix and suffix fields', () => {
    expect(ok('prefix:الص')).toEqual({ type: 'prefix', text: 'الص' });
    expect(ok('suffix:وة')).toEqual({ type: 'suffix', text: 'وة' });
  });

  it('verse reference', () => {
    expect(ok('2:43')).toEqual({ type: 'reference', ref: '2:43' });
    expect(ok('2:43-45')).toEqual({ type: 'reference', ref: '2:43-45' });
  });

  it('surah scope AND normalised', () => {
    expect(ok('surah:2,3 AND normalised:الصلوة')).toEqual({
      type: 'and',
      clauses: [
        { type: 'scoped', scope: { surahs: [2, 3] }, query: { type: 'all' } },
        { type: 'normalised', text: 'الصلوة' },
      ],
    });
  });

  it('root: the four surface forms parse to the value the engine resolves', () => {
    // The spaced form is the conventional way a root is written and the form
    // shown as a search chip. All four must parse; the engine (rootKey) maps
    // them to one postings key. This is the Part A defect: only the last two
    // parsed before.
    expect(ok('root:ز ك و')).toEqual({ type: 'root', root: 'ز ك و' });
    expect(ok('root:"ز ك و"')).toEqual({ type: 'root', root: 'ز ك و' });
    expect(ok('root:زكو')).toEqual({ type: 'root', root: 'زكو' });
    expect(ok('root:z-k-w')).toEqual({ type: 'root', root: 'z-k-w' });
  });

  it('spaced and quoted roots compose with AND surah:2 like the unspaced form', () => {
    const expected = {
      type: 'and',
      clauses: [
        { type: 'root', root: 'ز ك و' },
        { type: 'scoped', scope: { surahs: [2] }, query: { type: 'all' } },
      ],
    };
    expect(ok('root:ز ك و AND surah:2')).toEqual(expected);
    expect(ok('root:"ز ك و" AND surah:2')).toEqual(expected);
  });

  it('the spaced root ends at a multi-letter word or an operator, not mid-value', () => {
    // A multi-letter word is not absorbed: `صلوة` ends the root and becomes its
    // own term (which, with no operator joining it, is a parse error — the same
    // as any two juxtaposed terms). The root itself is still exactly three letters.
    expect(ok('root:ز ك و AND صلوة')).toEqual({
      type: 'and',
      clauses: [
        { type: 'root', root: 'ز ك و' },
        { type: 'normalised', text: 'صلوة' },
      ],
    });
    expect(ok('root:ز ك و OR root:ص ل و')).toEqual({
      type: 'or',
      clauses: [
        { type: 'root', root: 'ز ك و' },
        { type: 'root', root: 'ص ل و' },
      ],
    });
    // Juxtaposition without an operator is rejected, as for any two terms.
    expect(parseQuery('root:ز ك و صلوة').ok).toBe(false);
  });

  it('quoted values work for every field prefix, preserving inner spaces', () => {
    expect(ok('pattern:"مف*ول"')).toEqual({ type: 'pattern', pattern: 'مف*ول' });
    expect(ok('normalised:"الصلوة"')).toEqual({ type: 'normalised', text: 'الصلوة' });
    expect(ok('exact:"ٱلزَّكَوٰةَ"')).toEqual({ type: 'exact', text: 'ٱلزَّكَوٰةَ' });
    expect(ok('prefix:"الص"')).toEqual({ type: 'prefix', text: 'الص' });
    expect(ok('suffix:"وة"')).toEqual({ type: 'suffix', text: 'وة' });
    expect(ok('surah:"2,3"')).toEqual({
      type: 'scoped',
      scope: { surahs: [2, 3] },
      query: { type: 'all' },
    });
    expect(ok('segment:"2:43-45"')).toEqual({
      type: 'scoped',
      scope: { segmentRange: { surah: 2, from: 43, to: 45 } },
      query: { type: 'all' },
    });
    expect(ok('lemma:"زَكاة"')).toEqual({ type: 'lemma', lemma: 'زَكاة' });
    expect(ok('pos:"V"')).toEqual({ type: 'pos', pos: 'V' });
    // A quoted value keeps interior spaces verbatim rather than splitting.
    expect(ok('lemma:"ذُو ٱل"')).toEqual({ type: 'lemma', lemma: 'ذُو ٱل' });
  });

  it('a standalone quoted string is still an exact term, unchanged', () => {
    expect(ok('"الصلوة"')).toEqual({ type: 'exact', text: 'الصلوة' });
  });

  it('proximity operator', () => {
    expect(ok('زكوة NEAR/10 صلوة')).toEqual({
      type: 'proximity',
      left: { type: 'normalised', text: 'زكوة' },
      right: { type: 'normalised', text: 'صلوة' },
      distance: 10,
    });
  });

  it('adjacency operator', () => {
    expect(ok('واقيموا FOLLOWED_BY الصلوة')).toEqual({
      type: 'adjacency',
      left: { type: 'normalised', text: 'واقيموا' },
      right: { type: 'normalised', text: 'الصلوة' },
    });
  });

  it('nested boolean: A AND (B OR NOT C)', () => {
    expect(ok('صلوة AND (زكوة OR NOT صيام)')).toEqual({
      type: 'and',
      clauses: [
        { type: 'normalised', text: 'صلوة' },
        {
          type: 'or',
          clauses: [
            { type: 'normalised', text: 'زكوة' },
            { type: 'not', clause: { type: 'normalised', text: 'صيام' } },
          ],
        },
      ],
    });
  });
});

describe('parseQuery — malformed returns a typed error with position, never throws', () => {
  const cases: Array<[string, RegExp, number]> = [
    ['', /empty query/, 0],
    ['"unterminated', /unterminated quoted string/, 0],
    ['صلوة AND', /unexpected end of query/, 5],
    ['NEAR/abc', /malformed NEAR operator/, 0],
    ['(صلوة OR زكوة', /expected '\)'/, 9],
    ['surah:200', /out of range/, 0],
    ['surah:x', /invalid surah number/, 0],
    [')', /unexpected '\)'/, 0],
    ['foo:bar', /unknown field or malformed reference/, 0],
    ['pattern:', /empty value/, 0],
    ['AND صلوة', /expected a term but found operator/, 0],
    ['root:""', /empty value for 'root:'/, 0],
    ['root:"ز ك و', /unterminated quoted string/, 5],
    ['surah:"200"', /out of range/, 0],
  ];

  for (const [input, pattern, position] of cases) {
    it(`rejects ${JSON.stringify(input)}`, () => {
      const r = parseQuery(input);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error.message).toMatch(pattern);
        expect(r.error.position).toBe(position);
      }
    });
  }
});
