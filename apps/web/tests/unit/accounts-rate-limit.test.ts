import { beforeEach, describe, expect, it } from 'vitest';

import { createAccount } from '@/server/domain/accounts';
import { CONTRIBUTOR_TERMS_VERSION, RATE_LIMITS } from '@/server/domain/config';
import { reportContent } from '@/server/domain/moderation';
import { checkRateLimit } from '@/server/domain/rate-limit';
import { InMemoryStore } from '@/server/domain/store-memory';

let store: InMemoryStore;
beforeEach(() => {
  store = new InMemoryStore();
});

describe('createAccount', () => {
  const base = {
    email: 'Aisha@Example.com',
    handle: 'Aisha',
    acceptTermsVersion: CONTRIBUTOR_TERMS_VERSION,
    clientId: '203.0.113.7',
  };

  it('creates the user and records a terms acceptance at signup', async () => {
    const result = await createAccount(store, base);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user.email).toBe('aisha@example.com'); // normalised
      expect(result.user.handle).toBe('aisha');
      expect(await store.hasAcceptedTerms(result.user.id)).toBe(true);
    }
  });

  it('refuses signup that does not accept the current terms version', async () => {
    const result = await createAccount(store, { ...base, acceptTermsVersion: '0.9.0' });
    expect(result).toMatchObject({ ok: false, code: 'terms' });
  });

  it('rejects a duplicate email or handle', async () => {
    await createAccount(store, base);
    const dupHandle = await createAccount(store, {
      ...base,
      email: 'other@example.com',
    });
    expect(dupHandle).toMatchObject({ ok: false, code: 'taken' });
  });

  it('rate-limits account creation per client', async () => {
    for (let i = 0; i < RATE_LIMITS.SIGNUP.max; i++) {
      const r = await createAccount(store, {
        ...base,
        email: `u${i}@example.com`,
        handle: `user${i}`,
      });
      expect(r.ok).toBe(true);
    }
    const overflow = await createAccount(store, {
      ...base,
      email: 'flood@example.com',
      handle: 'flood',
    });
    expect(overflow).toMatchObject({ ok: false, code: 'rate_limited' });
  });
});

describe('checkRateLimit', () => {
  it('allows up to the limit, then blocks, then recovers after the window', async () => {
    const t0 = new Date('2026-07-25T10:00:00Z');
    for (let i = 0; i < RATE_LIMITS.RESPONSE.max; i++) {
      const r = await checkRateLimit(store, 'RESPONSE', 'user-1', t0);
      expect(r.ok).toBe(true);
    }
    const blocked = await checkRateLimit(store, 'RESPONSE', 'user-1', t0);
    expect(blocked.ok).toBe(false);

    // A different subject is unaffected.
    expect((await checkRateLimit(store, 'RESPONSE', 'user-2', t0)).ok).toBe(true);

    // After the window elapses, the subject is allowed again.
    const later = new Date(t0.getTime() + RATE_LIMITS.RESPONSE.windowMs + 1);
    expect((await checkRateLimit(store, 'RESPONSE', 'user-1', later)).ok).toBe(true);
  });
});

describe('reportContent', () => {
  it('writes a report to the moderation queue', async () => {
    const result = await reportContent(store, {
      reporterId: 'user-1',
      clientId: '203.0.113.7',
      targetType: 'INVESTIGATION',
      targetId: 'inv-1',
      reason: 'spam',
    });
    expect(result.ok).toBe(true);
    expect(store.reportCount()).toBe(1);
  });

  it('requires a reason', async () => {
    const result = await reportContent(store, {
      reporterId: null,
      clientId: '203.0.113.7',
      targetType: 'RESPONSE',
      targetId: 'res-1',
      reason: '   ',
    });
    expect(result).toMatchObject({ ok: false, code: 'reason' });
    expect(store.reportCount()).toBe(0);
  });
});
