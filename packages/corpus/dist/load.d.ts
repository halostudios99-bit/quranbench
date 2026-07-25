import type { Corpus } from './types.js';
export declare const DEFAULT_CORPUS_VERSION = "0.3.0";
/**
 * Thrown when an artifact fails validation. A corrupted or schema-drifted corpus
 * must never load silently — the invariant the rest of the system relies on is
 * that if `loadCorpus` returns, the corpus matched its manifest exactly.
 */
export declare class CorpusValidationError extends Error {
    constructor(message: string);
}
/**
 * Read and validate corpus artifacts for `version` from disk, returning typed
 * in-memory structures. Fails loudly — throws {@link CorpusValidationError} — on
 * schema drift or a count that disagrees with the manifest, so a corrupted
 * corpus can never load silently.
 */
export declare function loadCorpus(version?: string, options?: {
    root?: string;
}): Corpus;
