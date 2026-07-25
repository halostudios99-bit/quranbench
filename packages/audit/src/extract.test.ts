import { describe, expect, it } from 'vitest';
import { extract } from './extract.js';

describe('reference extraction', () => {
  it('reads a named reference with surah and verse', () => {
    const { references } = extract('See Quran Al-Baqarah 2:43 here.');
    expect(references).toHaveLength(1);
    expect(references[0]).toMatchObject({ surahName: 'Al-Baqarah', surah: 2, fromVerse: 43, toVerse: 43 });
  });

  it('reads a bare reference and a range', () => {
    const refs = extract('one 6:38 and two 2:156-157 done').references;
    expect(refs.map((r) => `${r.surah}:${r.fromVerse}-${r.toVerse}`)).toEqual(['6:38-38', '2:156-157']);
    expect(refs[0]!.surahName).toBeNull();
  });

  it('does not treat numbers without a colon as references', () => {
    expect(extract('lashed 80 times, 2.5 percent').references).toHaveLength(0);
  });
});

describe('box pairing', () => {
  const md = [
    '# T',
    '',
    '[box]',
    'Quran Al-Baqarah 2:43',
    '',
    'وَأَقِيمُوا۟ ٱلصَّلَوٰةَ',
    '',
    'And establish prayer[/box]',
    '',
    'Later, inline word صلاة appears in prose citing Quran 2:157 in a sentence.',
  ].join('\n');

  it('pairs the verse inside a box with its reference', () => {
    const { references } = extract(md);
    const paired = references.find((r) => r.surah === 2 && r.fromVerse === 43);
    expect(paired?.arabic).toContain('ٱلصَّلَوٰةَ');
  });

  it('leaves inline prose arabic loose and does not pair a prose reference', () => {
    const { references, looseArabic } = extract(md);
    const prose = references.find((r) => r.fromVerse === 157);
    expect(prose?.arabic).toBeNull();
    expect(looseArabic.some((q) => q.text === 'صلاة')).toBe(true);
  });
});

describe('root claim extraction', () => {
  it('extracts the zakat root claim with its target word', () => {
    const md = 'word الزَّكَاةَ meaning "Purify" and the root word for zakat is زَكَّىٰ Zaki but';
    const [claim] = extract(md).rootClaims;
    expect(claim?.targetTerm).toBe('zakat');
    expect(claim?.claimedRoot).toBe('زَكَّىٰ');
    expect(claim?.targetArabic).toBe('الزَّكَاةَ');
  });

  it('extracts a claim whose target carries its own arabic', () => {
    const [claim] = extract('Root word for Salat (صلاة) is Tasil (تصل) meaning contact').rootClaims;
    expect(claim?.claimedRoot).toBe('تصل');
    expect(claim?.targetArabic).toBe('صلاة');
  });
});

describe('transliteration extraction', () => {
  it('pairs a single Latin word with a single Arabic word', () => {
    const pairs = extract('the word Baraka (بَارَكًا) here').transliterations;
    expect(pairs).toContainEqual(expect.objectContaining({ translit: 'Baraka', arabic: 'بَارَكًا' }));
  });

  it('ignores multi-word glosses and quoted phrases', () => {
    const pairs = extract('donate قَرْضًا حَسَنًا (Massive Loan) to Allah').transliterations;
    expect(pairs).toHaveLength(0);
  });
});
