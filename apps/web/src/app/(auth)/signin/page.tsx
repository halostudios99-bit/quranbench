import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/server/auth';

import { SigninForm } from './SigninForm';
import { alertClass, alertStyle, noticeStyle } from '../form-styles';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to your quranbench account.',
  robots: { index: false, follow: true },
};

export default async function SigninPage({
  searchParams,
}: {
  searchParams: Promise<{ verified?: string; verify?: string }>;
}) {
  if (await getCurrentUser()) redirect('/account');
  const params = await searchParams;
  return (
    <section className="mx-auto max-w-reader">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight text-ink">Sign in</h1>
      <p className="mb-6 text-[15px] text-ink2">
        Signing in unlocks your own drafts and investigations. All corpus, search and
        downloads are open without an account.
      </p>
      {params.verified ? (
        <p className={`mb-4 ${alertClass}`} style={noticeStyle} role="status">
          Your email is verified. Sign in to continue.
        </p>
      ) : null}
      {params.verify === 'invalid' ? (
        <p className={`mb-4 ${alertClass}`} style={alertStyle} role="alert">
          That verification link is invalid or has expired. Sign in and request a new
          one from your account.
        </p>
      ) : null}
      <SigninForm />
    </section>
  );
}
