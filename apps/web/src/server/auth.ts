import 'server-only';

import { cookies, headers } from 'next/headers';

import {
  SESSION_COOKIE,
  sessionCookieAttributes,
} from './domain/session-cookie';
import {
  endSession,
  resolveSession,
  rotateSession,
  startSession,
} from './domain/sessions';
import type { User } from './domain/types';
import { prismaStore } from './store-prisma';

// The request-facing half of authentication: the session cookie and the current
// user. All rules live in the domain layer (domain/sessions.ts); this file only
// binds them to Next's cookie jar and the production store. Content code must
// never import payment state, and it never imports this — sign-in gates only a
// user's own work, never any public content (CLAUDE.md rules 5 and "nothing is
// gated").

export { SESSION_COOKIE };

const store = prismaStore;

function cookieOptions(expires: Date) {
  return sessionCookieAttributes(expires, process.env.NODE_ENV === 'production');
}

/** The signed-in user for this request, or null. Safe to call on any page. */
export async function getCurrentUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  try {
    return await resolveSession(store, token);
  } catch {
    // A database outage must never turn a public page into a 500; treat the
    // request as signed-out rather than failing the render.
    return null;
  }
}

/** Start a session for a user and set the cookie. */
export async function establishSession(userId: string): Promise<void> {
  const { token, expiresAt } = await startSession(store, userId);
  (await cookies()).set(SESSION_COOKIE, token, cookieOptions(expiresAt));
}

/** Rotate the session on a privilege change (e.g. after email verification). */
export async function rotateSessionCookie(userId: string): Promise<void> {
  const { token, expiresAt } = await rotateSession(store, userId);
  (await cookies()).set(SESSION_COOKIE, token, cookieOptions(expiresAt));
}

/** End the current session and clear the cookie. */
export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  await endSession(store, token);
  jar.delete(SESSION_COOKIE);
}

/** Best-effort client identifier (IP) for signup rate limiting. */
export async function clientId(): Promise<string> {
  const h = await headers();
  const fwd = h.get('x-forwarded-for');
  return fwd?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown';
}

// ─── Roles ────────────────────────────────────────────────────────────────────

/**
 * Whether a user may act with a given role. ADMIN implies MODERATOR.
 *
 * ADMIN_EMAILS bootstraps the first administrator: the database starts with no
 * privileged rows and the admin page is the only way to grant roles, so without
 * a bootstrap nobody could ever reach it. An email listed there acts as ADMIN
 * regardless of its row. Set once in the environment, then grant real roles and
 * remove it.
 */
export function hasRole(user: User | null, role: 'MODERATOR' | 'ADMIN'): boolean {
  if (!user) return false;
  const bootstrap = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (bootstrap.includes(user.email.toLowerCase())) return true;
  if (user.role === 'ADMIN') return true;
  return role === 'MODERATOR' && user.role === 'MODERATOR';
}
