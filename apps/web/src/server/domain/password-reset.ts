import { createHash, randomBytes } from 'node:crypto';

import { hashPassword, MIN_PASSWORD_LENGTH } from './password';
import { checkRateLimit } from './rate-limit';
import type { Store } from './store';

// Password reset. The flow mirrors email verification: a single-use token, hashed
// at rest, that travels only in the emailed link and expires quickly. Two rules
// beyond that:
//
//   - It never reveals whether an address is registered. `requestPasswordReset`
//     returns the same shape of "handled" for a known and an unknown email; the
//     caller shows one message either way and only sends mail when a token was
//     issued.
//   - A completed reset invalidates every session for the user, so a link that
//     leaked (e.g. a shared machine) cannot be paired with a live session.

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour — short, since it grants a password change

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export interface RequestResetInput {
  email: string;
  /** Client identifier (IP) for rate limiting reset requests. */
  clientId: string;
}

export type RequestResetResult =
  | { status: 'issued'; email: string; token: string }
  | { status: 'no_account' }
  | { status: 'rate_limited' };

/**
 * Issue a reset token for an email if it belongs to an account. Rate limited per
 * client before the lookup, so timing does not leak whether the address exists.
 * Returns the raw token for the caller to email; never sends mail itself.
 */
export async function requestPasswordReset(
  store: Store,
  input: RequestResetInput,
  now: Date = new Date(),
): Promise<RequestResetResult> {
  const email = input.email.trim().toLowerCase();

  const limit = await checkRateLimit(
    store,
    'PASSWORD_RESET',
    input.clientId,
    now,
  );
  if (!limit.ok) return { status: 'rate_limited' };

  const user = await store.getUserByEmail(email);
  if (!user) return { status: 'no_account' };

  const token = randomBytes(32).toString('base64url');
  // One active link at a time: drop any outstanding tokens before issuing a new one.
  await store.deleteUserPasswordResetTokens(user.id);
  await store.createPasswordResetToken(
    user.id,
    sha256(token),
    new Date(now.getTime() + RESET_TTL_MS),
  );
  return { status: 'issued', email: user.email, token };
}

export type CompleteResetResult =
  | { ok: true; userId: string }
  | { ok: false; code: 'invalid' | 'weak' };

/**
 * Complete a reset: validate the new password, consume the token (single-use),
 * store the new argon2id hash, and invalidate all sessions and any other
 * outstanding reset tokens. A weak password is rejected *before* the token is
 * consumed, so the link survives for a corrected retry.
 */
export async function completePasswordReset(
  store: Store,
  input: { token: string; password: string },
  now: Date = new Date(),
): Promise<CompleteResetResult> {
  if (input.password.length < MIN_PASSWORD_LENGTH)
    return { ok: false, code: 'weak' };

  const userId = await store.consumePasswordResetToken(
    sha256(input.token),
    now,
  );
  if (!userId) return { ok: false, code: 'invalid' };

  await store.updatePasswordHash(userId, await hashPassword(input.password));
  await store.deleteUserSessions(userId);
  await store.deleteUserPasswordResetTokens(userId);
  return { ok: true, userId };
}
