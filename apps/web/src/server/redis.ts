import 'server-only';

import Redis from 'ioredis';

import { redisRateLimiter, type RateLimiter } from './domain/rate-limit';

// The shared Redis client, created once per process and only when REDIS_URL is
// set. Without it the app runs exactly as before, with the store limiter — so
// single-process development and tests need no Redis. In production, pointing
// REDIS_URL at the compose `redis` service makes the rate limit hold across every
// replica (see docs/deployment.md).
//
// enableOfflineQueue:false + a tight retry budget make commands reject fast when
// Redis is down, so a write path fails closed promptly instead of hanging.

let client: Redis | null = null;

export function getRedisClient(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (!client) {
    client = new Redis(url, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
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
