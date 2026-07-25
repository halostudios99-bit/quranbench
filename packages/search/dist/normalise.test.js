import { describe, expect, it } from 'vitest';
import { canonicaliseUthmani, normaliseArabic } from './normalise.js';
describe('normaliseArabic', () => {
    it('strips tashkeel', () => {
        expect(normaliseArabic('بِسْمِ')).toBe('بسم');
    });
    it('unifies alef variants, maps teh marbuta and alef maksura, and NFC-orders', () => {
        // ٱلزَّكَوٰةَ → strip marks + alef wasla→alef + teh marbuta→heh
        expect(normaliseArabic('ٱلزَّكَوٰةَ')).toBe('الزكوه');
        // alef maksura (ى) → yeh (ي)
        expect(normaliseArabic('مُوسَىٰ')).toBe('موسي');
        // teh marbuta (ة) → heh (ه)
        expect(normaliseArabic('صَلَوٰة')).toBe('صلوه');
    });
    it('removes tatweel', () => {
        expect(normaliseArabic('الـلـه')).toBe('الله');
    });
    it('is idempotent', () => {
        const once = normaliseArabic('ٱلرَّحْمَٰنِ');
        expect(normaliseArabic(once)).toBe(once);
    });
});
describe('canonicaliseUthmani', () => {
    it('makes combining-mark serialisation irrelevant (shadda/vowel order)', () => {
        // Same abstract characters, different byte order. Built from code points so
        // the two strings are provably distinct: the corpus stores shadda (U+0651)
        // before the vowel (U+064E); NFC canonical order is vowel before shadda.
        const corpusOrder = String.fromCodePoint(0x0671, 0x0644, 0x0632, 0x0651, 0x064e, 0x0643, 0x064e, 0x0648, 0x0670, 0x0629, 0x064e);
        const nfcOrder = String.fromCodePoint(0x0671, 0x0644, 0x0632, 0x064e, 0x0651, 0x0643, 0x064e, 0x0648, 0x0670, 0x0629, 0x064e);
        expect(corpusOrder).not.toBe(nfcOrder);
        expect(canonicaliseUthmani(corpusOrder)).toBe(canonicaliseUthmani(nfcOrder));
    });
});
//# sourceMappingURL=normalise.test.js.map