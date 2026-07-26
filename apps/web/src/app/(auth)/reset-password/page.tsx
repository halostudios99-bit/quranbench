import type { Metadata } from 'next';

import { csrfToken } from '@/server/security/csrf';

import { ResetPasswordForm } from './ResetPasswordForm';
import { alertClass, alertStyle } from '../form-styles';

export const metadata: Metadata = {
  title: 'Set a new password',
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const csrf = await csrfToken();

  return (
    <section className="mx-auto max-w-reader">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight text-ink">
        Set a new password
      </h1>
      <p className="mb-6 text-[15px] text-ink2">
        Choose a new password. Setting it signs out every other device — you
        will sign in again with the new password.
      </p>
      {token ? (
        <ResetPasswordForm csrf={csrf} token={token} />
      ) : (
        <p role="alert" className={alertClass} style={alertStyle}>
          This page needs the reset link from your email. Request one from{' '}
          <a href="/forgot-password" className="underline">
            reset your password
          </a>
          .
        </p>
      )}
    </section>
  );
}
