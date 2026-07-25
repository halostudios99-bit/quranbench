import { beforeEach, describe, expect, it } from 'vitest';

import {
  createAccount,
  issueEmailVerification,
  verifyCredentials,
  verifyEmailToken,
} from '@/server/domain/accounts';
import { CONTRIBUTOR_TERMS_VERSION } from '@/server/domain/config';
import { hashPassword, verifyPasswordHash } from '@/server/domain/password';
import {
  SESSION_COOKIE,
  sessionCookieAttributes,
} from '@/server/domain/session-cookie';
import {
  endSession,
  hashSessionToken,
  resolveSession,
  rotateSession,
  startSession,
} from '@/server/domain/sessions';
import { InMemoryStore } from '@/server/domain/store-memory';

let store: InMemoryStore;
beforeEach(() => {
  store = new InMemoryStore();
});

async function signup(over: Record<string, string> = {}) {
  const result = await createAccount(store, {
    email: over.email ?? 'user@example.com',
    handle: over.handle ?? 'user',
    password: over.password ?? 'a-strong-passphrase',
    acceptTermsVersion: CONTRIBUTOR_TERMS_VERSION,
    clientId: '203.0.113.7',
  });
  if (!result.ok) throw new Error(`signup failed: ${result.message}`);
  return result.user;
}

describe('password hashing', () => {
  it('round-trips and rejects the wrong password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(await verifyPasswordHash('correct horse battery staple', hash)).toBe(true);
    expect(await verifyPasswordHash('wrong', hash)).toBe(false);
  });

  it('produces a distinct hash each time (random salt)', async () => {
    const a = await hashPassword('same');
    const b = await hashPassword('same');
    expect(a).not.toBe(b);
    expect(await verifyPasswordHash('same', a)).toBe(true);
    expect(await verifyPasswordHash('same', b)).toBe(true);
  });

  it('never stores the raw password', async () => {
    await signup({ password: 'plaintext-secret' });
    const credential = await store.findCredential('user@example.com');
    expect(credential).not.toBeNull();
    expect(credential!.passwordHash).not.toContain('plaintext-secret');
  });
});

describe('verifyCredentials', () => {
  it('returns the user for a correct email + password', async () => {
    const user = await signup();
    const got = await verifyCredentials(store, 'USER@example.com', 'a-strong-passphrase');
    expect(got?.id).toBe(user.id);
  });
  it('returns null for a wrong password or unknown email', async () => {
    await signup();
    expect(await verifyCredentials(store, 'user@example.com', 'nope')).toBeNull();
    expect(await verifyCredentials(store, 'ghost@example.com', 'whatever')).toBeNull();
  });
});

describe('sessions', () => {
  it('starts a session that resolves to its user, stored only as a hash', async () => {
    const user = await signup();
    const { token } = await startSession(store, user.id);
    // The store holds the hash, never the raw token.
    expect(await store.getSession(hashSessionToken(token))).not.toBeNull();
    const resolved = await resolveSession(store, token);
    expect(resolved?.id).toBe(user.id);
  });

  it('rejects and deletes an expired session', async () => {
    const user = await signup();
    const past = new Date('2020-01-01T00:00:00Z');
    const { token } = await startSession(store, user.id, past);
    const later = new Date('2020-06-01T00:00:00Z');
    expect(await resolveSession(store, token, later)).toBeNull();
    expect(await store.getSession(hashSessionToken(token))).toBeNull();
  });

  it('ends a session (sign out)', async () => {
    const user = await signup();
    const { token } = await startSession(store, user.id);
    await endSession(store, token);
    expect(await resolveSession(store, token)).toBeNull();
  });

  it('rotates on privilege change, invalidating the prior token', async () => {
    const user = await signup();
    const first = await startSession(store, user.id);
    const rotated = await rotateSession(store, user.id);
    expect(rotated.token).not.toBe(first.token);
    expect(await resolveSession(store, first.token)).toBeNull();
    expect((await resolveSession(store, rotated.token))?.id).toBe(user.id);
  });
});

describe('session cookie attributes', () => {
  it('is httpOnly, sameSite=lax, path=/ and secure in production', () => {
    const expires = new Date('2030-01-01T00:00:00Z');
    const prod = sessionCookieAttributes(expires, true);
    expect(prod).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      expires,
    });
    expect(sessionCookieAttributes(expires, false).secure).toBe(false);
    expect(SESSION_COOKIE).toBe('qb_session');
  });
});

describe('email verification', () => {
  it('marks the email verified when the token is consumed, one time only', async () => {
    const user = await signup();
    expect((await store.getUser(user.id))!.emailVerified).toBeNull();
    const token = await issueEmailVerification(store, user.id);
    const result = await verifyEmailToken(store, token);
    expect(result).toEqual({ ok: true, userId: user.id });
    expect((await store.getUser(user.id))!.emailVerified).toBeInstanceOf(Date);
    // A spent token cannot be replayed.
    expect(await verifyEmailToken(store, token)).toEqual({ ok: false });
  });

  it('rejects an expired token', async () => {
    const user = await signup();
    const past = new Date('2020-01-01T00:00:00Z');
    const token = await issueEmailVerification(store, user.id, past);
    const later = new Date('2020-01-03T00:00:00Z'); // beyond the 24h TTL
    expect(await verifyEmailToken(store, token, later)).toEqual({ ok: false });
  });
});
