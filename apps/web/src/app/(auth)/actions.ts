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
  createAccount,
  CURRENT_TERMS_VERSION,
  issueEmailVerification,
  verifyCredentials,
} from '@/server/research';

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

  if (!accepted)
    return { error: 'You must accept the contributor terms to create an account.', values };

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
  const user = await verifyCredentials(email, password);
  if (!user) return { error: 'Email or password is incorrect.', values: { email } };
  await establishSession(user.id);
  redirect('/account');
}

export async function signoutAction(): Promise<void> {
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
  _form: FormData,
): Promise<ResendState> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Sign in to resend a verification link.' };
  if (user.emailVerified) return { sent: true };
  const token = await issueEmailVerification(user.id);
  await getMailer().sendVerificationEmail(user.email, absoluteUrl(`/verify/${token}`));
  return { sent: true };
}
