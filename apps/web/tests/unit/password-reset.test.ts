import { beforeEach, describe, expect, it } from 'vitest';

import { createAccount, verifyCredentials } from '@/server/domain/accounts';
import { CONTRIBUTOR_TERMS_VERSION, RATE_LIMITS } from '@/server/domain/config';
import {
  completePasswordReset,
  requestPasswordReset,
} from '@/server/domain/password-reset';
import {
  hashSessionToken,
  startSession,
  resolveSession,
} from '@/server/domain/sessions';
import { InMemoryStore } from '@/server/domain/store-memory';

let store: InMemoryStore;
beforeEach(() => {
  store = new InMemoryStore();
});

async function seedUser(password = 'original-password') {
  const r = await createAccount(store, {
    email: 'user@example.com',
    handle: 'user',
    password,
    acceptTermsVersion: CONTRIBUTOR_TERMS_VERSION,
    clientId: 'ip',
  });
  if (!r.ok) throw new Error('seed failed');
  return r.user;
}

describe('requestPasswordReset', () => {
  it('issues a token for a known email', async () => {
    await seedUser();
    const r = await requestPasswordReset(store, {
      email: 'user@example.com',
      clientId: 'c',
    });
    expect(r.status).toBe('issued');
    if (r.status === 'issued') expect(r.token).toMatch(/^[\w-]+$/);
  });

  it('does not reveal whether an unknown email exists', async () => {
    const r = await requestPasswordReset(store, {
      email: 'ghost@example.com',
      clientId: 'c',
    });
    expect(r.status).toBe('no_account');
  });

  it('rate-limits requests per client', async () => {
    const { max } = RATE_LIMITS.PASSWORD_RESET;
    for (let i = 0; i < max; i++) {
      const r = await requestPasswordReset(store, {
        email: 'x@example.com',
        clientId: 'c',
      });
      expect(r.status).toBe('no_account');
    }
    const blocked = await requestPasswordReset(store, {
      email: 'x@example.com',
      clientId: 'c',
    });
    expect(blocked.status).toBe('rate_limited');
  });

  it('replaces an outstanding token when a new one is requested', async () => {
    await seedUser();
    const first = await requestPasswordReset(store, {
      email: 'user@example.com',
      clientId: 'c',
    });
    const second = await requestPasswordReset(store, {
      email: 'user@example.com',
      clientId: 'c',
    });
    if (first.status !== 'issued' || second.status !== 'issued')
      throw new Error();
    // The first token is now dead; only the second completes.
    expect(
      (
        await completePasswordReset(store, {
          token: first.token,
          password: 'new-password-1',
        })
      ).ok,
    ).toBe(false);
    expect(
      (
        await completePasswordReset(store, {
          token: second.token,
          password: 'new-password-2',
        })
      ).ok,
    ).toBe(true);
  });
});

describe('completePasswordReset', () => {
  async function issueFor(email = 'user@example.com') {
    const r = await requestPasswordReset(store, { email, clientId: 'c' });
    if (r.status !== 'issued') throw new Error('expected a token');
    return r.token;
  }

  it('sets the new password so the old one no longer works', async () => {
    const user = await seedUser('original-password');
    const token = await issueFor();
    const result = await completePasswordReset(store, {
      token,
      password: 'a-brand-new-password',
    });
    expect(result).toEqual({ ok: true, userId: user.id });
    expect(
      await verifyCredentials(store, 'user@example.com', 'original-password'),
    ).toBeNull();
    expect(
      (
        await verifyCredentials(
          store,
          'user@example.com',
          'a-brand-new-password',
        )
      )?.id,
    ).toBe(user.id);
  });

  it('is single-use: a spent token cannot be replayed', async () => {
    await seedUser();
    const token = await issueFor();
    expect(
      (
        await completePasswordReset(store, {
          token,
          password: 'first-new-password',
        })
      ).ok,
    ).toBe(true);
    const replay = await completePasswordReset(store, {
      token,
      password: 'second-new-password',
    });
    expect(replay).toEqual({ ok: false, code: 'invalid' });
  });

  it('honours expiry', async () => {
    await seedUser();
    const past = new Date('2020-01-01T00:00:00Z');
    const r = await requestPasswordReset(
      store,
      { email: 'user@example.com', clientId: 'c' },
      past,
    );
    if (r.status !== 'issued') throw new Error();
    const later = new Date('2020-01-01T02:00:00Z'); // beyond the 1h TTL
    expect(
      await completePasswordReset(
        store,
        { token: r.token, password: 'new-good-password' },
        later,
      ),
    ).toEqual({ ok: false, code: 'invalid' });
  });

  it('rejects a weak password without consuming the token', async () => {
    await seedUser();
    const token = await issueFor();
    expect(
      (await completePasswordReset(store, { token, password: 'short' })).ok,
    ).toBe(false);
    // The link still works for a corrected retry.
    expect(
      (
        await completePasswordReset(store, {
          token,
          password: 'a-valid-password',
        })
      ).ok,
    ).toBe(true);
  });

  it('invalidates all sessions on success', async () => {
    const user = await seedUser();
    const { token: sessionToken } = await startSession(store, user.id);
    expect(await resolveSession(store, sessionToken)).not.toBeNull();

    const resetToken = await issueFor();
    await completePasswordReset(store, {
      token: resetToken,
      password: 'a-valid-password',
    });

    expect(await resolveSession(store, sessionToken)).toBeNull();
    expect(await store.getSession(hashSessionToken(sessionToken))).toBeNull();
  });
});
