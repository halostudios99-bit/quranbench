import { canonicaliseUthmani } from './normalise.js';
function push(map, key, value) {
    const existing = map.get(key);
    if (existing)
        existing.push(value);
    else
        map.set(key, [value]);
}
/** Build the search index from a loaded corpus. Pure: reads only the corpus. */
export function buildIndex(corpus) {
    const tokens = corpus.tokens;
    const n = tokens.length;
    const segmentIdOf = new Array(n);
    const isBasmala = new Array(n);
    const byId = new Map();
    const exact = new Map();
    const normalised = new Map();
    const segmentTokens = new Map();
    const surahTokens = new Map();
    const segmentOrder = new Map();
    for (let i = 0; i < n; i++) {
        const t = tokens[i];
        segmentIdOf[i] = t.segment_id;
        isBasmala[i] = t.is_basmala;
        byId.set(t.id, i);
        push(exact, canonicaliseUthmani(t.text_uthmani), i);
        push(normalised, t.text_normalised, i);
        push(segmentTokens, t.segment_id, i);
        if (!segmentOrder.has(t.segment_id))
            segmentOrder.set(t.segment_id, segmentOrder.size);
        const surahList = surahTokens.get(t.surah);
        if (surahList)
            surahList.push(i);
        else
            surahTokens.set(t.surah, [i]);
    }
    const activeScheme = corpus.manifest.numbering.active;
    const refIndex = new Map();
    const segmentById = new Map();
    for (const segment of corpus.segments) {
        segmentById.set(segment.id, segment);
        const ordinal = segment.ordinals[activeScheme];
        if (ordinal === undefined)
            continue;
        let bySurah = refIndex.get(segment.surah);
        if (!bySurah) {
            bySurah = new Map();
            refIndex.set(segment.surah, bySurah);
        }
        bySurah.set(ordinal, segment);
    }
    return {
        corpus,
        version: corpus.version,
        tokens,
        segmentIdOf,
        isBasmala,
        byId,
        exact,
        normalised,
        segmentTokens,
        segmentById,
        surahTokens,
        segmentOrder,
        activeScheme,
        refIndex,
    };
}
//# sourceMappingURL=build-index.js.map