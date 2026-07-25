// Computation parameters (Prompt 03, Part C).
//
// Every computation over the corpus — a word count, a frequency, a search
// result — must carry and disclose the exact parameters under which it was
// produced. Reproducibility is a feature: a number without the parameters that
// produced it is not citable. This type exists before any statistic is computed
// anywhere, so that no number can be produced without recording how.
//
// The parameter set is serialisable to a short, stable string suitable for
// display beside a result and for inclusion in a citation, and parses back
// losslessly. It is pure data — nothing here reads the corpus or runs a query.

export type NormalisationProfile = 'uthmani' | 'simple' | 'no-tashkeel' | 'normalised';

export interface ComputationParams {
  /** The text edition a computation runs over, e.g. the ingested Uthmani. */
  textEdition: string;
  /** Corpus artifact version, e.g. '0.5.0'. A citation names a version. */
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

export const DEFAULT_PARAMS: ComputationParams = {
  textEdition: 'tanzil-uthmani',
  corpusVersion: '0.6.0',
  numberingScheme: 'kufan',
  includeBasmala: true,
  includeWaqfMarks: false,
  tashkeelCounted: false,
  normalisationProfile: 'normalised',
};

export function withDefaults(overrides: Partial<ComputationParams> = {}): ComputationParams {
  return { ...DEFAULT_PARAMS, ...overrides };
}

const NORMALISATION_PROFILES: readonly NormalisationProfile[] = [
  'uthmani',
  'simple',
  'no-tashkeel',
  'normalised',
];

// Fixed field order keeps the serialised form stable: identical params always
// produce the identical string, so it can key a cache or be compared verbatim.
const FIELDS = [
  'text',
  'corpus',
  'numbering',
  'basmala',
  'waqf',
  'tashkeel',
  'norm',
] as const;

function bit(value: boolean): '0' | '1' {
  return value ? '1' : '0';
}

/**
 * Serialise to a short, stable, single-line string. Example:
 * `text=tanzil-uthmani;corpus=0.5.0;numbering=kufan;basmala=1;waqf=0;tashkeel=0;norm=normalised`
 */
export function serialiseParams(p: ComputationParams): string {
  const parts: Record<(typeof FIELDS)[number], string> = {
    text: p.textEdition,
    corpus: p.corpusVersion,
    numbering: p.numberingScheme,
    basmala: bit(p.includeBasmala),
    waqf: bit(p.includeWaqfMarks),
    tashkeel: bit(p.tashkeelCounted),
    norm: p.normalisationProfile,
  };
  return FIELDS.map((f) => `${f}=${parts[f]}`).join(';');
}

function parseBit(field: string, value: string): boolean {
  if (value === '1') return true;
  if (value === '0') return false;
  throw new Error(`computation params: field '${field}' must be 0 or 1, got '${value}'`);
}

function isNormalisationProfile(value: string): value is NormalisationProfile {
  return (NORMALISATION_PROFILES as readonly string[]).includes(value);
}

/** Parse the string produced by {@link serialiseParams}, validating every field. */
export function parseParams(serialised: string): ComputationParams {
  const map = new Map<string, string>();
  for (const part of serialised.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) throw new Error(`computation params: malformed field '${part}'`);
    map.set(part.slice(0, eq), part.slice(eq + 1));
  }

  for (const field of FIELDS) {
    if (!map.has(field)) {
      throw new Error(`computation params: missing field '${field}'`);
    }
  }

  const norm = map.get('norm')!;
  if (!isNormalisationProfile(norm)) {
    throw new Error(`computation params: unknown normalisation profile '${norm}'`);
  }

  return {
    textEdition: map.get('text')!,
    corpusVersion: map.get('corpus')!,
    numberingScheme: map.get('numbering')!,
    includeBasmala: parseBit('basmala', map.get('basmala')!),
    includeWaqfMarks: parseBit('waqf', map.get('waqf')!),
    tashkeelCounted: parseBit('tashkeel', map.get('tashkeel')!),
    normalisationProfile: norm,
  };
}
