import { CONTRIBUTOR_TERMS_VERSION } from './config';
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

  const user = await store.createUser({
    email,
    handle,
    displayName: input.displayName?.trim() || null,
  });
  await store.recordTermsAcceptance(user.id, CONTRIBUTOR_TERMS_VERSION, now);
  return { ok: true, user };
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
