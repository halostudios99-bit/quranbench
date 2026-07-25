import type { ActionKind } from './types';

// The current contributor terms. Bumping this string is what makes an old
// acceptance stale; the text lives in docs/contributor-terms.md and renders at
// /terms/contributor. Recorded verbatim at signup (see accounts.ts).
export const CONTRIBUTOR_TERMS_VERSION = '1.0.0';

export interface RateLimit {
  /** Maximum actions allowed within the window. */
  max: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// Rate limits from day one (docs/extensibility.md §7): trivial now, painful in an
// incident. Chosen to stop scripted abuse while never obstructing a real user.
export const RATE_LIMITS: Record<ActionKind, RateLimit> = {
  // Account creation is per client (IP), not per user — there is no user yet.
  SIGNUP: { max: 5, windowMs: HOUR },
  // Publishing is real work; a handful a day per author is generous.
  PUBLISH: { max: 10, windowMs: DAY },
  // Responses are the highest-volume action; still bounded per author per hour.
  RESPONSE: { max: 30, windowMs: HOUR },
  // Reports gate on the reporter to blunt report-spam brigading.
  REPORT: { max: 20, windowMs: HOUR },
};

/** One sentence, and it must be short enough to be a claim, not an essay. */
export const CLAIM_MAX_LENGTH = 280;
