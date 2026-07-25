import { loadCorpus } from '@quranbench/corpus';
import { beforeAll, describe, expect, it } from 'vitest';

import { buildIndex, type SearchIndex } from './build-index.js';
import { normaliseArabic } from './normalise.js';
import { resolveReference } from './reference.js';
import { search, searchString } from './search.js';
import { UnsupportedQueryError, type Query } from './types.js';

// Documented, hand-verified figures for corpus v0.3.0. Derived from the
// artifacts directly (not from the code under test), and asserted as stable.
const EXACT_ZAKAT = 24; // text_uthmani ٱلزَّكَوٰةَ (fatha ending), NFC-exact
const NORM_ZAKAT = 26; // text_normalised الزكوه (adds the 2 kasra-ending forms)

let corpus: ReturnType<typeof loadCorpus>;
let index: SearchIndex;

beforeAll(() => {
  corpus = loadCorpus();
  index = buildIndex(corpus);
});

describe('index build', () => {
  it('indexes every token', () => {
    expect(index.tokens.length).toBe(77881);
    expect(index.byId.size).toBe(77881);
  });

  it('normaliser reproduces every stored text_normalised (no query/index drift)', () => {
    for (const token of corpus.tokens) {
      if (normaliseArabic(token.text_uthmani) !== token.text_normalised) {
        throw new Error(`normalisation drift at ${token.id}: got ${normaliseArabic(token.text_uthmani)}`);
      }
    }
  });
});

describe('exact query', () => {
  it('matches text_uthmani under canonical equivalence — stable count', () => {
    const r = search(index, { type: 'exact', text: 'ٱلزَّكَوٰةَ' });
    expect(r.totalMatches).toBe(EXACT_ZAKAT);
    for (const id of r.tokenIds) {
      expect(index.tokens[index.byId.get(id)!]!.text_normalised).toBe('الزكوه');
    }
  });

  it('carries the corpus version and computation params for reproducibility', () => {
    const r = search(index, { type: 'exact', text: 'ٱلزَّكَوٰةَ' });
    expect(r.corpusVersion).toBe('0.3.0');
    expect(r.params.corpusVersion).toBe('0.3.0');
    expect(r.params.numberingScheme).toBe('kufan');
    expect(r.segmentIds.length).toBeGreaterThan(0);
  });
});

describe('normalised query', () => {
  it('returns at least as many results as exact for the same word', () => {
    const exact = search(index, { type: 'exact', text: 'ٱلزَّكَوٰةَ' });
    const norm = search(index, { type: 'normalised', text: 'الزكوة' });
    expect(norm.totalMatches).toBe(NORM_ZAKAT);
    expect(norm.totalMatches).toBeGreaterThanOrEqual(exact.totalMatches);
  });
});

describe('prefix / suffix / pattern', () => {
  it('prefix matches normalised forms starting with the needle', () => {
    const r = search(index, { type: 'prefix', text: 'الزكو' });
    expect(r.totalMatches).toBe(26);
    for (const id of r.tokenIds) {
      expect(index.tokens[index.byId.get(id)!]!.text_normalised.startsWith('الزكو')).toBe(true);
    }
  });

  it('suffix matches normalised forms ending with the needle', () => {
    const r = search(index, { type: 'suffix', text: 'الزكوة' });
    expect(r.totalMatches).toBe(28); // الزكوه + وبالزكوه etc.
    for (const id of r.tokenIds) {
      expect(index.tokens[index.byId.get(id)!]!.text_normalised.endsWith('الزكوه')).toBe(true);
    }
  });

  it('pattern wildcard * over normalised forms', () => {
    const r = search(index, { type: 'pattern', pattern: 'الزك*' });
    expect(r.totalMatches).toBe(26);
  });

  it('pattern does not match across token boundaries', () => {
    // A pattern spanning a word break (space) can never match: index keys are
    // single tokens with no whitespace. الحمد follows بسم الله across tokens,
    // but no single token equals "بسم*الحمد".
    const r = search(index, { type: 'pattern', pattern: 'بسم*الحمد' });
    expect(r.totalMatches).toBe(0);
  });

  it('? matches exactly one character', () => {
    const three = search(index, { type: 'pattern', pattern: 'رب?' });
    expect(three.totalMatches).toBeGreaterThan(0);
    for (const id of three.tokenIds) {
      expect(index.tokens[index.byId.get(id)!]!.text_normalised.length).toBe(3);
    }
  });
});

describe('proximity', () => {
  it('finds salat and zakat within 10 tokens in the same segment (2:43), not a far control', () => {
    const q: Query = {
      type: 'proximity',
      left: { type: 'normalised', text: 'الصلوة' },
      right: { type: 'normalised', text: 'الزكوة' },
      distance: 10,
    };
    const r = search(index, q);
    expect(r.totalMatches).toBe(48);
    expect(r.segmentIds.length).toBe(24);
    expect(r.segmentIds).toContain('quran:tanzil-uthmani:2:43');
    // 10:87 contains salat but no nearby zakat — the control is not matched.
    expect(r.segmentIds).not.toContain('quran:tanzil-uthmani:10:87');
  });

  it('a tight window excludes a pair that is not adjacent enough', () => {
    const r = search(index, {
      type: 'proximity',
      left: { type: 'normalised', text: 'الصلوة' },
      right: { type: 'normalised', text: 'الزكوة' },
      distance: 1,
    });
    expect(r.totalMatches).toBe(0);
  });
});

describe('adjacency', () => {
  it('واقيموا FOLLOWED_BY الصلوة is ordered and same-segment', () => {
    const r = search(index, {
      type: 'adjacency',
      left: { type: 'normalised', text: 'واقيموا' },
      right: { type: 'normalised', text: 'الصلوة' },
    });
    expect(r.totalMatches).toBe(16); // 8 ordered pairs
    expect(r.segmentIds).toContain('quran:tanzil-uthmani:2:43');
    // reversed order does not match
    const rev = search(index, {
      type: 'adjacency',
      left: { type: 'normalised', text: 'الصلوة' },
      right: { type: 'normalised', text: 'واقيموا' },
    });
    expect(rev.totalMatches).toBe(0);
  });
});

describe('boolean nesting over a small fixture (surah 1)', () => {
  // Al-Fatiha, 29 tokens. الرحمن occurs twice (1:1:3, 1:3:1); الرحيم twice;
  // الله once. Hand-evaluated: (الرحمن OR الرحيم) AND NOT الرحيم, scoped to
  // surah 1, leaves exactly the two الرحمن tokens.
  it('A AND (B OR NOT C) evaluates correctly', () => {
    const inner: Query = {
      type: 'and',
      clauses: [
        {
          type: 'or',
          clauses: [
            { type: 'normalised', text: 'الرحمن' },
            { type: 'normalised', text: 'الرحيم' },
          ],
        },
        { type: 'not', clause: { type: 'normalised', text: 'الرحيم' } },
      ],
    };
    const r = search(index, { type: 'scoped', scope: { surahs: [1] }, query: inner });
    expect(r.tokenIds).toEqual(['quran:tanzil-uthmani:1:1:3', 'quran:tanzil-uthmani:1:3:1']);
  });
});

describe('scoped query', () => {
  it('restricts a normalised match to a surah list', () => {
    const all = search(index, { type: 'normalised', text: 'الله' });
    const scoped = search(index, {
      type: 'scoped',
      scope: { surahs: [1] },
      query: { type: 'normalised', text: 'الله' },
    });
    expect(scoped.totalMatches).toBe(1);
    expect(scoped.totalMatches).toBeLessThan(all.totalMatches);
    for (const id of scoped.tokenIds) expect(id.startsWith('quran:tanzil-uthmani:1:')).toBe(true);
  });
});

describe('reference resolution', () => {
  it('2:43 resolves to one segment, 2:43-45 to three', () => {
    expect(resolveReference(index, '2:43')!.map((s) => s.id)).toEqual([
      'quran:tanzil-uthmani:2:43',
    ]);
    expect(resolveReference(index, '2:43-45')!.map((s) => s.id)).toEqual([
      'quran:tanzil-uthmani:2:43',
      'quran:tanzil-uthmani:2:44',
      'quran:tanzil-uthmani:2:45',
    ]);
  });

  it('9:1 and 2:255 exist; 2:0 does not resolve', () => {
    expect(resolveReference(index, '9:1')).toHaveLength(1);
    expect(resolveReference(index, '2:255')).toHaveLength(1);
    expect(resolveReference(index, '2:0')).toHaveLength(0);
  });

  it('a reference query returns all tokens in the resolved segment', () => {
    const r = search(index, { type: 'reference', ref: '2:43' });
    expect(r.segmentIds).toEqual(['quran:tanzil-uthmani:2:43']);
    expect(r.tokenIds[0]).toBe('quran:tanzil-uthmani:2:43:1');
    expect(r.totalMatches).toBe(7);
  });
});

describe('basmala parameter', () => {
  it('excludes separated basmala tokens when includeBasmala is false', () => {
    const withB = search(index, { type: 'normalised', text: 'بسم' }, { includeBasmala: true });
    const withoutB = search(index, { type: 'normalised', text: 'بسم' }, { includeBasmala: false });
    expect(withoutB.totalMatches).toBeLessThan(withB.totalMatches);
    for (const id of withoutB.tokenIds) {
      expect(index.tokens[index.byId.get(id)!]!.is_basmala).toBe(false);
    }
  });
});

describe('unimplemented morphology queries', () => {
  it('throw rather than fabricating matches', () => {
    expect(() => search(index, { type: 'root', root: 'ز ك و' })).toThrow(UnsupportedQueryError);
    expect(() => search(index, { type: 'lemma', lemma: 'زكاة' })).toThrow(UnsupportedQueryError);
  });
});

describe('searchString', () => {
  it('parses and runs a string query', () => {
    const r = searchString(index, '"ٱلزَّكَوٰةَ"');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result.totalMatches).toBe(EXACT_ZAKAT);
  });

  it('returns a typed error for a malformed query, never throws', () => {
    const r = searchString(index, 'surah:999');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toMatch(/out of range/);
  });

  it('runs a full compound string query', () => {
    const r = searchString(index, 'surah:2 AND normalised:الصلوة');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.totalMatches).toBeGreaterThan(0);
      for (const id of r.result.tokenIds) {
        expect(id.startsWith('quran:tanzil-uthmani:2:')).toBe(true);
      }
    }
  });
});
