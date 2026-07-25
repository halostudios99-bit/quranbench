import { beforeAll, describe, expect, it } from 'vitest';
import { loadCorpus } from '@quranbench/corpus';
import { auditArticle, createContext, type AuditContext } from './index.js';
import type { Finding } from './types.js';

let ctx: AuditContext;
beforeAll(() => {
  ctx = createContext(loadCorpus());
});

function findings(markdown: string): Finding[] {
  return auditArticle(ctx, { file: 't.md', markdown }).findings;
}

describe('root claims', () => {
  it('flags the 2017 zakat root error against the corpus root ز ك و', () => {
    const md = 'word الزَّكَاةَ and the root word for zakat is زَكَّىٰ Zaki but';
    const f = findings(md).find((x) => x.kind === 'root-claim');
    expect(f?.status).toBe('flagged');
    expect(f?.corpusRoots?.[0]).toBe('ز ك و');
  });

  it('flags the salat root claim (تصل) against ص ل و', () => {
    const md = 'Root word for Salat (صلاة) is Tasil (تصل) meaning contact';
    const f = findings(md).find((x) => x.kind === 'root-claim');
    expect(f?.status).toBe('flagged');
    expect(f?.corpusRoots).toContain('ص ل و');
  });
});

describe('verse references', () => {
  it('verifies a correctly quoted verse at canonical level', () => {
    const seg = ctx.corpus.segments.find((s) => s.surah === 2 && s.slot === '43')!;
    const md = `# T\n\n[box]\nQuran Al-Baqarah 2:43\n\n${seg.text_uthmani}\n\ntranslation[/box]\n`;
    const q = findings(md).find((f) => f.kind === 'quoted-arabic' && f.reference === '2:43');
    expect(q?.status).toBe('verified');
    expect(q?.matchLevel).toBe('canonical');
  });

  it('flags a reference that does not resolve', () => {
    const f = findings('See Quran 2:999 for details.').find((x) => x.kind === 'verse-reference');
    expect(f?.status).toBe('flagged');
    expect(f?.severity).toBe('high');
  });

  it('flags a surah name that belongs to a different surah than the number', () => {
    const f = findings('as in Quran Al-Maida 27:4 says').find((x) => x.kind === 'surah-name');
    expect(f?.status).toBe('flagged');
    expect(f?.summary).toContain('An-Naml');
    expect(f?.detail).toContain('surah 5');
  });

  it('accepts a spelling variant of the surah name', () => {
    const f = findings('Quran Al-Bakarah 2:43').find((x) => x.kind === 'surah-name');
    expect(f?.status).toBe('verified');
  });

  it('accepts vowel-transliteration variants of a surah name', () => {
    for (const name of ['An-Nur 24:35', 'Al-Khaf 18:50', 'Al-Imran 3:39']) {
      const f = findings(`Quran ${name}`).find((x) => x.kind === 'surah-name');
      expect(f?.status, name).toBe('verified');
    }
  });

  it('treats a hadith citation as an unchecked external source, not a bad verse', () => {
    const f = findings('as in Sahih Bukhari 8:82:820 it says').find((x) => x.kind === 'verse-reference');
    expect(f?.status).toBe('unchecked');
    expect(f?.summary).toContain('external');
  });

  it('names the verse a quote actually matches when the citation is wrong', () => {
    const real = ctx.corpus.segments.find((s) => s.surah === 6 && s.slot === '38')!;
    const md = `# T\n\nQuran 2:2\n\n${real.text_uthmani}\n\ntranslation\n`;
    const f = findings(md).find((x) => x.kind === 'quoted-arabic');
    expect(f?.status).toBe('flagged');
    expect(f?.summary).toContain('6:38');
  });
});

describe('quoted arabic presence', () => {
  it('verifies a real Quranic word regardless of orthography', () => {
    const seg = ctx.corpus.segments.find((s) => s.surah === 2 && s.slot === '43')!;
    const word = seg.text_uthmani.split(/\s+/)[1]!; // ٱلصَّلَوٰةَ
    const f = findings(`the word ${word} appears`).find((x) => x.kind === 'quoted-arabic');
    expect(f?.status).toBe('verified');
  });

  it('flags non-Quranic text that appears nowhere', () => {
    const f = findings('the word كمبيوتر means computer').find((x) => x.kind === 'quoted-arabic');
    expect(f?.status).toBe('flagged');
  });
});

describe('report shape', () => {
  it('never marks anything as corrected and ranks by flagged severity', () => {
    const report = auditArticle(ctx, {
      file: 'z.md',
      markdown: 'word الزَّكَاةَ root word for zakat is زَكَّىٰ and Quran 2:999 is broken',
    });
    expect(report.workScore).toBeGreaterThan(0);
    expect(report.counts.flagged).toBeGreaterThanOrEqual(2);
    expect(report.provenance).toContain('nothing was corrected');
  });
});
