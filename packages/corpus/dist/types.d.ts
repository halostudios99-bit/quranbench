/** A text tradition or edition an artifact field is sourced from. sources.json. */
export interface Source {
    id: string;
    name: string;
    publisher: string;
    edition: string;
    year: number | null;
    url: string;
    licence: string;
    role: string;
    sha256: string;
}
/** The separated (or inline) surah-opening basmala, as recorded on a surah. */
export interface SurahBasmala {
    separated: boolean;
    text_uthmani: string;
    text_simple: string;
    text_no_tashkeel: string;
    text_normalised: string;
    token_range: {
        slot: string;
        first_id: string;
        last_id: string;
        count: number;
    };
}
/** A surah's metadata. surahs.json. */
export interface Surah {
    id: string;
    number: number;
    name_ar: string;
    name_translit: string;
    name_en: string;
    revelation_place: string;
    revelation_order: number;
    verse_count: number;
    basmala: SurahBasmala;
    source_id: string;
}
/**
 * An addressable segment — a counted verse row. verses.jsonl.
 *
 * Note: separated basmala segments are NOT verse rows and do not appear here.
 * They exist only as token groupings (Token.segment_id ending in `:basmala`).
 * `ordinals` maps a numbering scheme id to the ordinal that scheme assigns.
 */
export interface Segment {
    id: string;
    work_id: string;
    source_id: string;
    surah: number;
    slot: string;
    ordinals: Record<string, number>;
    text_uthmani: string;
    text_simple: string;
    text_no_tashkeel: string;
    text_normalised: string;
    leading_marks: string[];
}
/** An addressable atom — a whitespace-delimited word. tokens.jsonl. */
export interface Token {
    id: string;
    segment_id: string;
    surah: number;
    slot: string;
    position: number;
    text_uthmani: string;
    text_simple: string;
    text_no_tashkeel: string;
    text_normalised: string;
    char_start: number;
    char_end: number;
    following_marks: string[];
    is_basmala: boolean;
}
/** A verse-counting tradition, expressed as data. numbering/<id>.json. */
export interface NumberingScheme {
    id: string;
    name: string;
    full_name?: string;
    source: Record<string, unknown>;
    is_default: boolean;
    note?: string;
    rules: {
        order: string;
        reset_per: string;
        start_at: number;
        counts: Record<string, boolean>;
    };
}
/** The build manifest. manifest.json. Every result traces back to this. */
export interface Manifest {
    corpus_version: string;
    previous_version: string | null;
    work_id: string;
    built_at: string;
    generator: string;
    segmentation_scheme: string;
    identifier_format: string;
    counts: {
        surahs: number;
        verses: number;
        tokens: number;
    };
    numbering: {
        active: string;
        default: string;
        available: string[];
        verse_counts: Record<string, number>;
        note?: string;
    };
    basmala_handling: string;
    basmala: Record<string, unknown>;
    token_segmentation: Record<string, unknown>;
    source_download_options?: Record<string, unknown>;
    sources: Array<{
        id: string;
        sha256: string;
    }>;
    field_provenance: Record<string, unknown>;
    token_field_provenance: Record<string, unknown>;
    normalisation_rules: Array<{
        id: string;
        description: string;
        applies_to: string[];
        detail: string;
    }>;
}
/**
 * The loaded, validated, in-memory corpus. Pure data: no search, no computation.
 * `manifest` is exposed so any consumer can report exactly which version and
 * build parameters produced a result.
 */
export interface Corpus {
    version: string;
    manifest: Manifest;
    sources: Source[];
    surahs: Surah[];
    /** Counted verse rows only. See Segment. */
    segments: Segment[];
    tokens: Token[];
    numbering: Map<string, NumberingScheme>;
    /** sha256 of each loaded artifact file, computed at load time. */
    checksums: Record<string, string>;
}
