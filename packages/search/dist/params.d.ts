export type NormalisationProfile = 'uthmani' | 'simple' | 'no-tashkeel' | 'normalised';
export interface ComputationParams {
    /** The text edition a computation runs over, e.g. the ingested Uthmani. */
    textEdition: string;
    /** Corpus artifact version, e.g. '0.3.0'. A citation names a version. */
    corpusVersion: string;
    /** Verse numbering scheme in effect, e.g. 'kufan'. Numbering is a parameter. */
    numberingScheme: string;
    /** Whether a separated surah-opening basmala is included in the computation. */
    includeBasmala: boolean;
    /** Whether standalone waqf/pause marks are included (they are not tokens). */
    includeWaqfMarks: boolean;
    /** Whether tashkeel (diacritics) count when measuring characters. */
    tashkeelCounted: boolean;
    /** Which text form a computation reads. */
    normalisationProfile: NormalisationProfile;
}
export declare const DEFAULT_PARAMS: ComputationParams;
export declare function withDefaults(overrides?: Partial<ComputationParams>): ComputationParams;
/**
 * Serialise to a short, stable, single-line string. Example:
 * `text=tanzil-uthmani;corpus=0.3.0;numbering=kufan;basmala=1;waqf=0;tashkeel=0;norm=normalised`
 */
export declare function serialiseParams(p: ComputationParams): string;
/** Parse the string produced by {@link serialiseParams}, validating every field. */
export declare function parseParams(serialised: string): ComputationParams;
