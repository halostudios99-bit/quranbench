// Arabic normalisation, replicating the corpus pipeline's `text_normalised`
// derivation so that query input is normalised identically to indexed forms.
// The rules mirror manifest.normalisation_rules for corpus v0.3.0. A test
// asserts this reproduces every stored token.text_normalised; if the pipeline's
// rules change, that test fails rather than search drifting silently.
function inRange(code, lo, hi) {
    return code >= lo && code <= hi;
}
// strip-tashkeel: Arabic diacritical / recitation marks.
function isTashkeel(code) {
    return (inRange(code, 0x0610, 0x061a) ||
        inRange(code, 0x064b, 0x065f) ||
        code === 0x0670 ||
        inRange(code, 0x06d6, 0x06dc) ||
        inRange(code, 0x06df, 0x06e8) ||
        inRange(code, 0x06ea, 0x06ed));
}
const ALEF = 'ا';
const ALEF_VARIANTS = new Set([0x0622, 0x0623, 0x0625, 0x0671]);
/**
 * Normalise Arabic text to the corpus `text_normalised` form: strip tashkeel,
 * remove tatweel, unify alef variants, map teh marbuta → heh and alef maksura →
 * yeh, then NFC. Diacritic- and orthography-insensitive. Idempotent.
 */
export function normaliseArabic(input) {
    let out = '';
    for (const ch of input) {
        const code = ch.codePointAt(0);
        if (isTashkeel(code))
            continue;
        if (code === 0x0640)
            continue; // remove-tatweel
        if (ALEF_VARIANTS.has(code)) {
            out += ALEF;
            continue;
        }
        if (code === 0x0629) {
            out += 'ه'; // teh marbuta → heh
            continue;
        }
        if (code === 0x0649) {
            out += 'ي'; // alef maksura → yeh
            continue;
        }
        out += ch;
    }
    return out.normalize('NFC');
}
/**
 * Canonicalise Uthmani text for *exact* matching. The corpus stores combining
 * marks in Uthmani order (e.g. shadda before a vowel), which is not Unicode NFC
 * order. Exact match is by canonical equivalence — diacritic- and
 * orthography-sensitive, but insensitive to combining-mark serialisation — so a
 * user's NFC-ordered query still matches the corpus's stored bytes.
 */
export function canonicaliseUthmani(input) {
    return input.normalize('NFC');
}
//# sourceMappingURL=normalise.js.map