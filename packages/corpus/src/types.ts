// Types mirroring the corpus build artifacts under
// packages/corpus-build/out/<version>/. These are the on-disk schemas, typed.
// The loader (load.ts) is the only place that reads files; everything else in
// the system consumes these structures in memory.

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

/**
 * One sub-word morpheme of a token: a prefix, the stem, or a suffix. `text` is
 * the morpheme's Leeds surface form; concatenating a token's segment texts
 * reproduces its morphological surface. `root`/`root_slug`/`lemma` are present
 * only where the morpheme carries them (stems have roots; clitics have lemmas).
 */
export interface MorphSegment {
  text: string;
  type: 'prefix' | 'stem' | 'suffix';
  pos: string;
  /** Spaced-Arabic root, e.g. `ز ك و`. Present on root-bearing stems only. */
  root?: string;
  /** URL transliteration of `root`, e.g. `z-k-w`. */
  root_slug?: string;
  lemma?: string;
  features: Record<string, unknown>;
}

/**
 * A token's morphological annotation (Leeds QAC, GPL — see the manifest's
 * `morphology` block and docs/licensing.md). An annotation layer: it never
 * changes the token's id, position or text. Word-level `root`/`lemma`/`pos`/
 * `features` are taken from the token's head stem; `segments` is the full
 * prefix/stem/suffix breakdown.
 */
export interface Morphology {
  /** Spaced-Arabic root, or null for particles, pronouns, proper nouns, muqaṭṭaʿāt. */
  root: string | null;
  root_slug: string | null;
  lemma: string | null;
  pos: string;
  features: Record<string, unknown>;
  segments: MorphSegment[];
  morphology_source: string;
  /** How the Leeds word aligned onto this token (provenance of the annotation). */
  alignment: string;
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
  morphology: Morphology;
}

/**
 * One root and every token it appears in. morphology/roots.json.
 * `root` is the spaced-Arabic identity form; `root_slug` its URL transliteration.
 */
export interface Root {
  root: string;
  root_slug: string;
  /** Distinct lemmas under this root, most frequent first. */
  lemmas: string[];
  occurrences: number;
  /** Token ids carrying this root, in corpus order. */
  token_ids: string[];
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
  sources: Array<{ id: string; sha256: string }>;
  /**
   * sha256 and byte size of every emitted artifact, keyed by POSIX-relative
   * path, excluding the manifest itself. Lets the loader — and any third party —
   * verify a published corpus byte-for-byte, not just structurally.
   */
  checksums: Record<string, { sha256: string; bytes: number }>;
  field_provenance: Record<string, unknown>;
  token_field_provenance: Record<string, unknown>;
  normalisation_rules: Array<{
    id: string;
    description: string;
    applies_to: string[];
    detail: string;
  }>;
  /** Morphology provenance: source, alignment summary, root counts, licence. */
  morphology?: Record<string, unknown>;
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
  /** One record per root (morphology/roots.json), most frequent first. */
  roots: Root[];
  numbering: Map<string, NumberingScheme>;
  /** sha256 of each loaded artifact file, computed at load time. */
  checksums: Record<string, string>;
}
