import { afterEach, describe, expect, it } from 'vitest';

import {
  checkRateLimit,
  redisRateLimiter,
  setRateLimiterProvider,
  storeRateLimiter,
  type RedisSortedSet,
} from '@/server/domain/rate-limit';
import { RATE_LIMITS } from '@/server/domain/config';
import { InMemoryStore } from '@/server/domain/store-memory';

// A faithful in-memory fake of the four sorted-set commands the Redis limiter
// uses. Enough to prove the sliding-window logic without a live Redis; the same
// limiter runs against the real thing in Docker (docs/deployment.md).
class FakeRedis implements RedisSortedSet {
  private sets = new Map<string, { score: number; member: string }[]>();
  private failing = false;

  fail() {
    this.failing = true;
  }
  private guard() {
    if (this.failing) throw new Error('redis unavailable');
  }
  async zremrangebyscore(key: string, min: number, max: number) {
    this.guard();
    const set = this.sets.get(key) ?? [];
    const kept = set.filter((e) => e.score < min || e.score > max);
    this.sets.set(key, kept);
    return set.length - kept.length;
  }
  async zcard(key: string) {
    this.guard();
    return (this.sets.get(key) ?? []).length;
  }
  async zadd(key: string, score: number, member: string) {
    this.guard();
    const set = this.sets.get(key) ?? [];
    set.push({ score, member });
    this.sets.set(key, set);
    return 1;
  }
  async pexpire() {
    this.guard();
    return 1;
  }
}

afterEach(() => setRateLimiterProvider(null));

describe('redisRateLimiter (shared store)', () => {
  it('allows up to the limit within the window, then denies', async () => {
    const redis = new FakeRedis();
    const limiter = redisRateLimiter(redis);
    const { max } = RATE_LIMITS.SIGNUP;
    const now = new Date('2026-07-26T00:00:00Z');

    for (let i = 0; i < max; i++) {
      const r = await limiter.hit('SIGNUP', '203.0.113.7', now);
      expect(r.ok).toBe(true);
      expect(r.used).toBe(i + 1);
    }
    const denied = await limiter.hit('SIGNUP', '203.0.113.7', now);
    expect(denied.ok).toBe(false);
  });

  it('lets attempts through again once the window has passed', async () => {
    const redis = new FakeRedis();
    const limiter = redisRateLimiter(redis);
    const { max, windowMs } = RATE_LIMITS.SIGNUP;
    const start = new Date('2026-07-26T00:00:00Z');
    for (let i = 0; i < max; i++) await limiter.hit('SIGNUP', 'ip', start);
    expect((await limiter.hit('SIGNUP', 'ip', start)).ok).toBe(false);

    const later = new Date(start.getTime() + windowMs + 1);
    expect((await limiter.hit('SIGNUP', 'ip', later)).ok).toBe(true);
  });

  it('keeps subjects independent', async () => {
    const redis = new FakeRedis();
    const limiter = redisRateLimiter(redis);
    const now = new Date('2026-07-26T00:00:00Z');
    for (let i = 0; i < RATE_LIMITS.SIGNUP.max; i++)
      await limiter.hit('SIGNUP', 'a', now);
    expect((await limiter.hit('SIGNUP', 'a', now)).ok).toBe(false);
    expect((await limiter.hit('SIGNUP', 'b', now)).ok).toBe(true);
  });
});

describe('checkRateLimit backend selection and fallback', () => {
  it('uses the configured Redis limiter when a provider is set', async () => {
    const redis = new FakeRedis();
    setRateLimiterProvider(() => redisRateLimiter(redis));
    const store = new InMemoryStore();
    const now = new Date('2026-07-26T00:00:00Z');
    for (let i = 0; i < RATE_LIMITS.SIGNUP.max; i++)
      expect((await checkRateLimit(store, 'SIGNUP', 'ip', now)).ok).toBe(true);
    expect((await checkRateLimit(store, 'SIGNUP', 'ip', now)).ok).toBe(false);
    // The store limiter was never touched.
    expect(await store.countActions('SIGNUP', 'ip', new Date(0))).toBe(0);
  });

  it('falls back to the store limiter when no provider is configured', async () => {
    const store = new InMemoryStore();
    const now = new Date('2026-07-26T00:00:00Z');
    const r = await checkRateLimit(store, 'SIGNUP', 'ip', now);
    expect(r.ok).toBe(true);
    expect(await store.countActions('SIGNUP', 'ip', new Date(0))).toBe(1);
  });

  it('fails CLOSED for a write when the Redis backend throws', async () => {
    const redis = new FakeRedis();
    redis.fail();
    setRateLimiterProvider(() => redisRateLimiter(redis));
    const store = new InMemoryStore();
    const r = await checkRateLimit(store, 'PUBLISH', 'author', new Date());
    expect(r.ok).toBe(false);
    expect(r.degraded).toBe(true);
  });
});

describe('storeRateLimiter still enforces (single-process / tests)', () => {
  it('denies past the limit', async () => {
    const store = new InMemoryStore();
    const limiter = storeRateLimiter(store);
    const now = new Date('2026-07-26T00:00:00Z');
    for (let i = 0; i < RATE_LIMITS.REPORT.max; i++)
      expect((await limiter.hit('REPORT', 's', now)).ok).toBe(true);
    expect((await limiter.hit('REPORT', 's', now)).ok).toBe(false);
  });
});
