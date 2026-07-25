// Verse-reference resolution: `2:43`, `2:43-45`, `2:255`. A reference names a
// surah and a verse ordinal (or inclusive range) under the active numbering
// scheme. Ordinals are an attribute of a segment, not its identity — resolution
// is therefore always relative to a scheme (see docs/extensibility.md §4).
const REFERENCE_RE = /^(\d+):(\d+)(?:-(\d+))?$/;
/** Parse reference *syntax* only. Returns null if the string is not a reference. */
export function parseReference(ref) {
    const m = REFERENCE_RE.exec(ref.trim());
    if (!m)
        return null;
    const surah = Number(m[1]);
    const from = Number(m[2]);
    const to = m[3] === undefined ? from : Number(m[3]);
    if (to < from)
        return null;
    return { surah, from, to };
}
/**
 * Resolve a reference to its segments under the index's active numbering scheme.
 * Returns the segments that exist; an out-of-range ordinal (e.g. `2:0`) yields an
 * empty list rather than an error. Returns null only if `ref` is not a reference.
 */
export function resolveReference(index, ref) {
    const parsed = parseReference(ref);
    if (!parsed)
        return null;
    const bySurah = index.refIndex.get(parsed.surah);
    if (!bySurah)
        return [];
    const segments = [];
    for (let ordinal = parsed.from; ordinal <= parsed.to; ordinal++) {
        const segment = bySurah.get(ordinal);
        if (segment)
            segments.push(segment);
    }
    return segments;
}
//# sourceMappingURL=reference.js.map