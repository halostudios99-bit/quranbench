import { randomUUID } from 'node:crypto';

import { RATE_LIMITS } from './config';
import type { Store } from './store';
import type { ActionKind } from './types';

export interface RateLimitResult {
  ok: boolean;
  /** Actions already taken in the current window. */
  used: number;
  limit: number;
  retryAfterMs: number;
  /** True when the backend was unavailable and a fail policy was applied. */
  degraded?: boolean;
}

// The rate-limit seam. A limiter records an attempt for (kind, subject) inside its
// window and reports whether it was allowed. Two implementations sit behind this
// interface: `storeRateLimiter` (in-memory in tests, Postgres in single-process
// dev — it counts ActionEvent rows) and `redisRateLimiter` (the shared store used
// across replicas in production). Because the counter lives in one shared place,
// the limit holds no matter which replica serves the request.

export interface RateLimiter {
  /**
   * Record one attempt and report the outcome. Throws only on a backend failure
   * (e.g. Redis unreachable); `checkRateLimit` decides fail-open vs fail-closed.
   */
  hit(
    kind: ActionKind,
    subject: string,
    now: Date,
  ): Promise<{ ok: boolean; used: number; retryAfterMs: number }>;
}

// Fail policy on backend unavailability. Every kind here is a state-changing write,
// so all fail CLOSED: if the shared counter cannot be reached, deny rather than let
// an attacker bypass the limit by knocking Redis over. Read-path limiting lives in
// server/api/http.ts and fails OPEN by design — it is a courtesy backstop, not a
// security control, and public reads must never be taken down by a limiter outage.
const FAIL_OPEN: Record<ActionKind, boolean> = {
  SIGNUP: false,
  PUBLISH: false,
  RESPONSE: false,
  REPORT: false,
  PASSWORD_RESET: false,
};

/** Count ActionEvent rows in the trailing window; record this one if under limit. */
export function storeRateLimiter(store: Store): RateLimiter {
  return {
    async hit(kind, subject, now) {
      const { max, windowMs } = RATE_LIMITS[kind];
      const since = new Date(now.getTime() - windowMs);
      const used = await store.countActions(kind, subject, since);
      if (used >= max) return { ok: false, used, retryAfterMs: windowMs };
      await store.recordAction(kind, subject, now);
      return { ok: true, used: used + 1, retryAfterMs: 0 };
    },
  };
}

// The subset of Redis commands the sliding-window limiter uses. Depending on this
// narrow shape rather than a concrete client keeps the domain free of any Redis
// library (ioredis is bound in server/redis.ts) and lets the window logic be
// tested against a faithful in-memory fake, and against a real Redis in Docker.
export interface RedisSortedSet {
  zremrangebyscore(key: string, min: number, max: number): Promise<number>;
  zcard(key: string): Promise<number>;
  zadd(key: string, score: number, member: string): Promise<number | string>;
  pexpire(key: string, ms: number): Promise<number>;
}

/** A sliding-window limiter over a Redis sorted set keyed by (kind, subject). */
export function redisRateLimiter(
  client: RedisSortedSet,
  keyPrefix = 'rl',
): RateLimiter {
  return {
    async hit(kind, subject, now) {
      const { max, windowMs } = RATE_LIMITS[kind];
      const key = `${keyPrefix}:${kind}:${subject}`;
      const nowMs = now.getTime();
      await client.zremrangebyscore(key, 0, nowMs - windowMs);
      const used = await client.zcard(key);
      if (used >= max) return { ok: false, used, retryAfterMs: windowMs };
      await client.zadd(key, nowMs, `${nowMs}-${randomUUID()}`);
      await client.pexpire(key, windowMs);
      return { ok: true, used: used + 1, retryAfterMs: 0 };
    },
  };
}

// Provider indirection: production binds a Redis limiter at boot (server/redis.ts)
// without the domain layer importing a Redis library. Null → fall back to the
// store limiter, which is exactly the single-process / test behaviour.
let provider: (() => RateLimiter | null) | null = null;
export function setRateLimiterProvider(
  p: (() => RateLimiter | null) | null,
): void {
  provider = p;
}

/**
 * A trailing-window limiter. Uses the shared Redis store when one is configured,
 * otherwise the store limiter. On a backend failure the fail policy for the kind
 * decides the outcome (writes fail closed). `now` is injected for determinism.
 */
export async function checkRateLimit(
  store: Store,
  kind: ActionKind,
  subject: string,
  now: Date = new Date(),
): Promise<RateLimitResult> {
  const { max, windowMs } = RATE_LIMITS[kind];
  const limiter = provider?.() ?? storeRateLimiter(store);
  try {
    const r = await limiter.hit(kind, subject, now);
    return { ok: r.ok, used: r.used, limit: max, retryAfterMs: r.retryAfterMs };
  } catch (err) {
    const ok = FAIL_OPEN[kind];
    if (process.env.NODE_ENV !== 'test')
      console.error(
        `[rate-limit] backend unavailable for ${kind}; failing ${ok ? 'open' : 'closed'}:`,
        err,
      );
    return {
      ok,
      used: 0,
      limit: max,
      retryAfterMs: ok ? 0 : windowMs,
      degraded: true,
    };
  }
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
