import 'server-only';

import Redis from 'ioredis';

import { redisRateLimiter, type RateLimiter } from './domain/rate-limit';

// The shared Redis client, created once per process and only when REDIS_URL is
// set. Without it the app runs exactly as before, with the store limiter — so
// single-process development and tests need no Redis. In production, pointing
// REDIS_URL at the compose `redis` service makes the rate limit hold across every
// replica (see docs/deployment.md).
//
// Commands must reject *promptly* when Redis is unreachable, so a write path
// fails closed rather than hanging. That bound is enforced by `commandTimeout`
// plus a tight retry budget.
//
// It is deliberately NOT enforced by `enableOfflineQueue: false`, which was the
// earlier approach. That setting cannot tell "Redis is down" from "the client
// has not finished its opening handshake yet", so the first request after boot
// threw `Stream isn't writeable` and the limiter failed closed on a perfectly
// healthy Redis — rejecting a correction submission in CI, and equally rejecting
// real submissions for the reconnect window after any Redis restart. Queueing
// with a hard timeout keeps the fail-fast guarantee and removes the false
// negative.

let client: Redis | null = null;

export function getRedisClient(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (!client) {
    client = new Redis(url, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: true,
      commandTimeout: 1000,
      connectTimeout: 3000,
    });
    // An unhandled 'error' on an ioredis client is fatal; swallow it here so a
    // Redis outage degrades to the fail-closed policy instead of crashing.
    client.on('error', () => {});
  }
  return client;
}

let limiter: RateLimiter | null = null;

/** The production rate limiter, or null when no Redis is configured. */
export function getRedisRateLimiter(): RateLimiter | null {
  const c = getRedisClient();
  if (!c) return null;
  if (!limiter) limiter = redisRateLimiter(c);
  return limiter;
}
