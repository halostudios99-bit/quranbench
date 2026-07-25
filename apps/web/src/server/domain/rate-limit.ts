import { RATE_LIMITS } from './config';
import type { Store } from './store';
import type { ActionKind } from './types';

export interface RateLimitResult {
  ok: boolean;
  /** Actions already taken in the current window. */
  used: number;
  limit: number;
  retryAfterMs: number;
}

/**
 * A trailing-window limiter. Counts the subject's actions of this kind since the
 * window opened; if under the limit it records this one and allows it. `now` is
 * injected so the limiter is deterministic and testable. Enforced in the data
 * layer — every mutating service calls it before doing work.
 */
export async function checkRateLimit(
  store: Store,
  kind: ActionKind,
  subject: string,
  now: Date = new Date(),
): Promise<RateLimitResult> {
  const { max, windowMs } = RATE_LIMITS[kind];
  const since = new Date(now.getTime() - windowMs);
  const used = await store.countActions(kind, subject, since);
  if (used >= max) {
    return { ok: false, used, limit: max, retryAfterMs: windowMs };
  }
  await store.recordAction(kind, subject, now);
  return { ok: true, used: used + 1, limit: max, retryAfterMs: 0 };
}

export class RateLimitError extends Error {
  constructor(
    public readonly kind: ActionKind,
    public readonly retryAfterMs: number,
  ) {
    super(`rate limit exceeded for ${kind}`);
    this.name = 'RateLimitError';
  }
}
