import { createHash, randomBytes } from 'node:crypto';

import type { Store } from './store';
import type { User } from './types';

// Session tokens. The raw token is what the browser holds in its cookie; only its
// SHA-256 hash is ever stored, so a database leak does not hand an attacker live
// sessions. The token is 256 bits of CSPRNG output, so it is unguessable and
// needs no additional signing. Rotation on privilege change (verifying email,
// signing in) mints a new token and drops the old one — see rotateSession.

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const TOKEN_BYTES = 32;

/** Mint a fresh, unguessable session token (returned raw, stored hashed). */
export function newSessionToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

/** The at-rest form of a session token. Never store the raw token. */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface StartedSession {
  token: string;
  expiresAt: Date;
}

/** Create a session for a user and return the raw token to set as a cookie. */
export async function startSession(
  store: Store,
  userId: string,
  now: Date = new Date(),
): Promise<StartedSession> {
  const token = newSessionToken();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await store.createSession(userId, hashSessionToken(token), expiresAt);
  return { token, expiresAt };
}

/**
 * Resolve a raw session token to its user, or null. An expired session is
 * deleted on read so stale rows do not accumulate and a lapsed token never
 * authenticates.
 */
export async function resolveSession(
  store: Store,
  token: string | undefined,
  now: Date = new Date(),
): Promise<User | null> {
  if (!token) return null;
  const tokenHash = hashSessionToken(token);
  const session = await store.getSession(tokenHash);
  if (!session) return null;
  if (session.expiresAt.getTime() <= now.getTime()) {
    await store.deleteSession(tokenHash);
    return null;
  }
  return store.getUser(session.userId);
}

/** End a single session (sign out). Idempotent. */
export async function endSession(store: Store, token: string | undefined): Promise<void> {
  if (!token) return;
  await store.deleteSession(hashSessionToken(token));
}

/**
 * Rotate a session on a privilege change: drop every existing session for the
 * user and issue a fresh token. Used after email verification so a token minted
 * before verification cannot be replayed against the newly-privileged account.
 */
export async function rotateSession(
  store: Store,
  userId: string,
  now: Date = new Date(),
): Promise<StartedSession> {
  await store.deleteUserSessions(userId);
  return startSession(store, userId, now);
}
