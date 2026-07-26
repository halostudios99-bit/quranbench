'use server';

import { redirect } from 'next/navigation';

import { absoluteUrl } from '@/lib/site';
import {
  clientId,
  destroySession,
  establishSession,
  getCurrentUser,
} from '@/server/auth';
import { getMailer } from '@/server/mailer';
import {
  completePasswordReset,
  createAccount,
  CURRENT_TERMS_VERSION,
  issueEmailVerification,
  requestPasswordReset,
  verifyCredentials,
} from '@/server/research';
import { verifyCsrf } from '@/server/security/csrf';

const CSRF_ERROR = 'Your session expired. Reload the page and try again.';

// Server actions for the auth flow. Each returns a typed form state on failure
// and redirects on success. Sessions and cookies are handled in @/server/auth;
// these actions only orchestrate the domain rules and the redirect.

export interface AuthFormState {
  error?: string;
  /** Preserve entered values so a failed submit does not clear the form. */
  values?: { email?: string; handle?: string; displayName?: string };
}

function str(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === 'string' ? v : '';
}

export async function signupAction(
  _prev: AuthFormState,
  form: FormData,
): Promise<AuthFormState> {
  const email = str(form, 'email');
  const handle = str(form, 'handle');
  const password = str(form, 'password');
  const displayName = str(form, 'displayName');
  const accepted = form.get('acceptTerms') === 'on';
  const values = { email, handle, displayName };

  if (!(await verifyCsrf(form))) return { error: CSRF_ERROR, values };
  if (!accepted)
    return {
      error: 'You must accept the contributor terms to create an account.',
      values,
    };

  const result = await createAccount({
    email,
    handle,
    password,
    displayName: displayName || null,
    acceptTermsVersion: CURRENT_TERMS_VERSION,
    clientId: await clientId(),
  });

  if (!result.ok) return { error: result.message, values };

  // Send the verification link (console mailer in development) and sign the user
  // in. They may draft immediately; publishing waits on verification.
  const token = await issueEmailVerification(result.user.id);
  await getMailer().sendVerificationEmail(
    result.user.email,
    absoluteUrl(`/verify/${token}`),
  );
  await establishSession(result.user.id);
  redirect('/account?welcome=1');
}

export async function signinAction(
  _prev: AuthFormState,
  form: FormData,
): Promise<AuthFormState> {
  const email = str(form, 'email');
  const password = str(form, 'password');
  if (!(await verifyCsrf(form)))
    return { error: CSRF_ERROR, values: { email } };
  const user = await verifyCredentials(email, password);
  if (!user)
    return { error: 'Email or password is incorrect.', values: { email } };
  await establishSession(user.id);
  redirect('/account');
}

export async function signoutAction(form: FormData): Promise<void> {
  // A forged sign-out is low-impact, but the token is required for consistency and
  // to keep this off the list of routes a cross-site POST can reach.
  if (!(await verifyCsrf(form))) redirect('/');
  await destroySession();
  redirect('/');
}

export interface ResendState {
  sent?: boolean;
  error?: string;
}

/** Re-issue and re-send the verification link for the signed-in user. */
export async function resendVerificationAction(
  _prev: ResendState,
  form: FormData,
): Promise<ResendState> {
  if (!(await verifyCsrf(form))) return { error: CSRF_ERROR };
  const user = await getCurrentUser();
  if (!user) return { error: 'Sign in to resend a verification link.' };
  if (user.emailVerified) return { sent: true };
  const token = await issueEmailVerification(user.id);
  await getMailer().sendVerificationEmail(
    user.email,
    absoluteUrl(`/verify/${token}`),
  );
  return { sent: true };
}

// ─── Password reset ───────────────────────────────────────────────────────────

export interface ForgotState {
  done?: boolean;
  error?: string;
  values?: { email?: string };
}

/**
 * Request a reset link. The response is identical whether or not the address is
 * registered, so a stranger cannot use this to discover accounts. Mail is sent
 * only when a token was actually issued.
 */
export async function forgotPasswordAction(
  _prev: ForgotState,
  form: FormData,
): Promise<ForgotState> {
  const email = str(form, 'email');
  if (!(await verifyCsrf(form)))
    return { error: CSRF_ERROR, values: { email } };

  const result = await requestPasswordReset({
    email,
    clientId: await clientId(),
  });
  if (result.status === 'rate_limited')
    return {
      error: 'Too many reset requests from here. Try again later.',
      values: { email },
    };
  if (result.status === 'issued')
    await getMailer().sendPasswordResetEmail(
      result.email,
      absoluteUrl(`/reset-password?token=${result.token}`),
    );
  // 'issued' and 'no_account' both land here: same message, existence not revealed.
  return { done: true };
}

export interface ResetState {
  error?: string;
  values?: { token?: string };
}

/** Complete a reset from the emailed link. On success, all sessions are gone and
 *  the user is sent to sign in with the new password. */
export async function resetPasswordAction(
  _prev: ResetState,
  form: FormData,
): Promise<ResetState> {
  const token = str(form, 'token');
  const password = str(form, 'password');
  const confirm = str(form, 'confirm');
  const values = { token };

  if (!(await verifyCsrf(form))) return { error: CSRF_ERROR, values };
  if (password !== confirm)
    return { error: 'The two passwords do not match.', values };

  const result = await completePasswordReset({ token, password });
  if (!result.ok)
    return {
      error:
        result.code === 'weak'
          ? 'Password must be at least 8 characters.'
          : 'This reset link is invalid or has expired. Request a new one.',
      values,
    };

  redirect('/signin?reset=1');
}
