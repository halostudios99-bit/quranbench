import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/server/auth';
import { csrfToken } from '@/server/security/csrf';

import { ForgotPasswordForm } from './ForgotPasswordForm';

export const metadata: Metadata = {
  title: 'Reset your password',
  description: 'Request a link to reset your quranbench password.',
  robots: { index: false, follow: true },
};

export default async function ForgotPasswordPage() {
  if (await getCurrentUser()) redirect('/account');
  const csrf = await csrfToken();
  return (
    <section className="mx-auto max-w-reader">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight text-ink">
        Reset your password
      </h1>
      <p className="mb-6 text-[15px] text-ink2">
        Enter the email on your account and we will send a link to set a new
        password. The link works once and expires in an hour.
      </p>
      <ForgotPasswordForm csrf={csrf} />
      <p className="mt-4 text-[14px] text-ink2">
        Remembered it?{' '}
        <a href="/signin" className="text-accent underline">
          Sign in
        </a>
        .
      </p>
    </section>
  );
}
