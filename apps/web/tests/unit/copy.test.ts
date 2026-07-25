import { describe, expect, it } from 'vitest';

import {
  attributionLine,
  buildAllCopyPayloads,
  buildCopyPayload,
  COPY_VARIANTS,
  type CopySource,
} from '@/actions/copy';

const SOURCE: CopySource = {
  arabicUthmani: 'وَأَقِيمُوا۟ ٱلصَّلَوٰةَ وَءَاتُوا۟ ٱلزَّكَوٰةَ',
  arabicPlain: 'واقيموا الصلوة وءاتوا الزكوة',
  reference: 'Al-Baqarah 2:43',
  edition: 'Tanzil Uthmani 1.1',
  corpusVersion: '0.5.0',
  url: 'https://quranbench.com/2/43',
};

describe('copy payloads', () => {
  it('Arabic-only carries no attribution — the sole exception', () => {
    const p = buildCopyPayload('arabic-uthmani', SOURCE);
    expect(p.text).toBe(SOURCE.arabicUthmani);
    expect(p.text).not.toContain(SOURCE.reference);
    expect(p.text).not.toContain(SOURCE.url);
    expect(p.text).not.toContain(SOURCE.corpusVersion);
    expect(p.html).toContain('dir="rtl"');
  });

  it('Arabic without tashkeel appends the reference and source', () => {
    const p = buildCopyPayload('arabic-plain', SOURCE);
    expect(p.text).toBe(
      'واقيموا الصلوة وءاتوا الزكوة\n— Quran Al-Baqarah 2:43 · Tanzil Uthmani 1.1 · corpus v0.5.0 · https://quranbench.com/2/43',
    );
    expect(p.html).toContain('dir="rtl"');
    expect(p.html).toContain('<a href="https://quranbench.com/2/43">');
  });

  it('Arabic + reference includes the Uthmani text and the attribution line', () => {
    const p = buildCopyPayload('arabic-ref', SOURCE);
    expect(p.text).toBe(`${SOURCE.arabicUthmani}\n${attributionLine(SOURCE)}`);
    expect(p.text).toContain('Al-Baqarah 2:43');
    expect(p.text).toContain('Tanzil Uthmani 1.1');
  });

  it('Citation names the corpus version and the canonical URL', () => {
    const p = buildCopyPayload('citation', SOURCE);
    expect(p.text).toBe(
      'وَأَقِيمُوا۟ ٱلصَّلَوٰةَ وَءَاتُوا۟ ٱلزَّكَوٰةَ\nQuran Al-Baqarah 2:43 (Tanzil Uthmani 1.1). quranbench, corpus v0.5.0. https://quranbench.com/2/43',
    );
    expect(p.html).toContain('corpus v0.5.0');
  });

  it('every variant writes both text/plain and text/html flavours', () => {
    const all = buildAllCopyPayloads(SOURCE);
    expect(all).toHaveLength(COPY_VARIANTS.length);
    for (const p of all) {
      expect(p.text.length).toBeGreaterThan(0);
      expect(p.html.length).toBeGreaterThan(0);
      expect(p.html).toContain('dir="rtl"');
    }
  });

  it('every variant except Arabic-only carries the reference and source', () => {
    for (const { variant } of COPY_VARIANTS) {
      const p = buildCopyPayload(variant, SOURCE);
      if (variant === 'arabic-uthmani') continue;
      expect(p.text, variant).toContain(SOURCE.reference);
      expect(p.text, variant).toContain(SOURCE.edition);
      expect(p.text, variant).toContain(SOURCE.corpusVersion);
      expect(p.text, variant).toContain(SOURCE.url);
    }
  });

  it('the HTML flavour escapes so it cannot inject markup', () => {
    const hostile: CopySource = { ...SOURCE, reference: 'A & B <x> "q"' };
    const p = buildCopyPayload('arabic-ref', hostile);
    expect(p.html).toContain('A &amp; B &lt;x&gt; &quot;q&quot;');
    expect(p.html).not.toContain('<x>');
  });
});
