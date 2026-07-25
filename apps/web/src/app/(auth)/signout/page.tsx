import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/server/auth';

import { signoutAction } from '../actions';
import { formButtonClass } from '../form-styles';

export const metadata: Metadata = {
  title: 'Sign out',
  robots: { index: false, follow: false },
};

// Sign-out is a POST (never a GET link) so it cannot be triggered by a prefetch
// or a cross-site image. Without JavaScript this button still works — it submits
// a form that runs the server action.
export default async function SignoutPage() {
  if (!(await getCurrentUser())) redirect('/');
  return (
    <section className="mx-auto max-w-reader">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight text-ink">Sign out</h1>
      <p className="mb-6 text-[15px] text-ink2">
        Sign out of this device. Your work stays on your account.
      </p>
      <form action={signoutAction}>
        <button type="submit" className={formButtonClass}>
          Sign out
        </button>
      </form>
    </section>
  );
}
