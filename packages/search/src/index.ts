// Placeholder for the in-memory index + query engine.
// Everything here must stay a pure function of (index, query) — no DB, no HTTP,
// no Next.js. The engine is built in a later prompt.

export const SEARCH_ENGINE_READY = false as const;

// The computation parameter set exists before the engine does: no statistic may
// be produced without recording the parameters that produced it (Part C).
export type { ComputationParams, NormalisationProfile } from './params.js';
export {
  DEFAULT_PARAMS,
  withDefaults,
  serialiseParams,
  parseParams,
} from './params.js';
