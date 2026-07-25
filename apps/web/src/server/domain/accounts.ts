import { createHash, randomBytes } from 'node:crypto';

import { CONTRIBUTOR_TERMS_VERSION } from './config';
import { hashPassword, MIN_PASSWORD_LENGTH, verifyPasswordHash } from './password';
import { checkRateLimit } from './rate-limit';
import type { Store } from './store';
import type { User } from './types';

export class TermsNotAcceptedError extends Error {
  constructor(public readonly userId: string) {
    super(
      'contributor terms have not been accepted; content cannot be created until they are',
    );
    this.name = 'TermsNotAcceptedError';
  }
}

const HANDLE_RE = /^[a-z0-9](?:[a-z0-9_-]{1,30}[a-z0-9])?$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type CreateAccountResult =
  | { ok: true; user: User }
  | { ok: false; code: 'invalid' | 'taken' | 'terms' | 'rate_limited'; message: string };

export interface CreateAccountInput {
  email: string;
  handle: string;
  password: string;
  displayName?: string | null;
  /** The user must accept the current contributor terms at signup. */
  acceptTermsVersion: string;
  /** Client identifier (IP) for rate limiting account creation. */
  clientId: string;
}

/**
 * Create an account and record contributor-terms acceptance in the same step.
 * Signup is the only place terms are recorded, and a user that reaches the rest
 * of the system therefore always has an acceptance on file. Rate limited per
 * client so the endpoint cannot be scripted.
 */
export async function createAccount(
  store: Store,
  input: CreateAccountInput,
  now: Date = new Date(),
): Promise<CreateAccountResult> {
  const email = input.email.trim().toLowerCase();
  const handle = input.handle.trim().toLowerCase();

  if (!EMAIL_RE.test(email))
    return { ok: false, code: 'invalid', message: 'A valid email is required.' };
  if (!HANDLE_RE.test(handle))
    return {
      ok: false,
      code: 'invalid',
      message:
        'Handle must be 2–32 characters: lowercase letters, digits, hyphen or underscore.',
    };
  if (input.password.length < MIN_PASSWORD_LENGTH)
    return {
      ok: false,
      code: 'invalid',
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  if (input.acceptTermsVersion !== CONTRIBUTOR_TERMS_VERSION)
    return {
      ok: false,
      code: 'terms',
      message: 'The current contributor terms must be accepted to create an account.',
    };

  const limit = await checkRateLimit(store, 'SIGNUP', input.clientId, now);
  if (!limit.ok)
    return {
      ok: false,
      code: 'rate_limited',
      message: 'Too many accounts created from here. Try again later.',
    };

  if (await store.getUserByEmail(email))
    return { ok: false, code: 'taken', message: 'That email is already registered.' };
  if (await store.getUserByHandle(handle))
    return { ok: false, code: 'taken', message: 'That handle is taken.' };

  const passwordHash = await hashPassword(input.password);
  const user = await store.createUser({
    email,
    handle,
    displayName: input.displayName?.trim() || null,
    passwordHash,
  });
  await store.recordTermsAcceptance(user.id, CONTRIBUTOR_TERMS_VERSION, now);
  return { ok: true, user };
}

/**
 * Check an email + password against the stored credential. Returns the user on a
 * match, else null. Runs a verify against a decoy hash when the account is
 * unknown so a caller cannot distinguish "no such email" from "wrong password"
 * by timing.
 */
const DECOY_HASH =
  'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

export async function verifyCredentials(
  store: Store,
  email: string,
  password: string,
): Promise<User | null> {
  const credential = await store.findCredential(email.trim().toLowerCase());
  if (!credential) {
    await verifyPasswordHash(password, DECOY_HASH);
    return null;
  }
  const ok = await verifyPasswordHash(password, credential.passwordHash);
  return ok ? credential.user : null;
}

// ─── Email verification ───────────────────────────────────────────────────────
// Verification is a one-time token: the raw token travels in the link, only its
// hash is stored, and it is consumed on use. Publishing is gated on a verified
// email (see the publish gate), so this is what unlocks contribution.

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Issue a verification token for a user; returns the raw token for the link. */
export async function issueEmailVerification(
  store: Store,
  userId: string,
  now: Date = new Date(),
): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  await store.createEmailVerificationToken(
    userId,
    tokenHash,
    new Date(now.getTime() + VERIFY_TTL_MS),
  );
  return token;
}

export type VerifyEmailResult =
  | { ok: true; userId: string }
  | { ok: false };

/** Consume a verification token and mark the email verified. Idempotent-safe:
 *  a spent or expired token simply fails rather than throwing. */
export async function verifyEmailToken(
  store: Store,
  token: string,
  now: Date = new Date(),
): Promise<VerifyEmailResult> {
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const userId = await store.consumeEmailVerificationToken(tokenHash, now);
  if (!userId) return { ok: false };
  await store.markEmailVerified(userId, now);
  return { ok: true, userId };
}

/**
 * The data-layer content gate. Every content-creating service calls this first;
 * a user without a recorded acceptance cannot create an investigation, response,
 * annotation or any other contribution. Throws so it can never be forgotten.
 */
export async function assertCanContribute(
  store: Store,
  userId: string,
): Promise<void> {
  if (!(await store.hasAcceptedTerms(userId)))
    throw new TermsNotAcceptedError(userId);
}
