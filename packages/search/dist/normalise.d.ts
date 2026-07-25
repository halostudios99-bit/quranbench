/**
 * Normalise Arabic text to the corpus `text_normalised` form: strip tashkeel,
 * remove tatweel, unify alef variants, map teh marbuta → heh and alef maksura →
 * yeh, then NFC. Diacritic- and orthography-insensitive. Idempotent.
 */
export declare function normaliseArabic(input: string): string;
/**
 * Canonicalise Uthmani text for *exact* matching. The corpus stores combining
 * marks in Uthmani order (e.g. shadda before a vowel), which is not Unicode NFC
 * order. Exact match is by canonical equivalence — diacritic- and
 * orthography-sensitive, but insensitive to combining-mark serialisation — so a
 * user's NFC-ordered query still matches the corpus's stored bytes.
 */
export declare function canonicaliseUthmani(input: string): string;
