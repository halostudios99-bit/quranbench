// @quranbench/corpus — a typed loader for corpus build artifacts.
// Loading and typing only: no search, no computation. Layer 1 of the
// architecture (docs/architecture.md) — immutable, versioned, read-only.

export type {
  Corpus,
  LoadedTranslation,
  Manifest,
  Morphology,
  MorphSegment,
  NumberingScheme,
  Root,
  Segment,
  Source,
  Surah,
  SurahBasmala,
  Token,
  TranslationEdition,
  TranslationLine,
  TranslationsManifest,
} from './types.js';

export { CorpusValidationError, DEFAULT_CORPUS_VERSION, loadCorpus } from './load.js';
