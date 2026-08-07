import type { Metadata } from 'next';

import { donationBySession } from '@/server/donations';

export const metadata: Metadata = { title: 'Thank you — QuranBench' };

interface Props {
  searchParams: Promise<{ session_id?: string }>;
}

export default async function ThanksPage({ searchParams }: Props) {
  const { session_id } = await searchParams;
  // The webhook is the source of truth; this page only reflects it. A PENDING
  // state here just means the webhook has not landed yet, which is normal.
  const donation = session_id ? await donationBySession(session_id) : null;

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-[28px] font-semibold text-ink">Thank you</h1>
      <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink2">
        {donation
          ? 'Your gift has been received — thank you for keeping this project running.'
          : 'If you completed a payment, it is being confirmed now.'}
        {donation?.userId
          ? ' The supporter badge is on your account.'
          : ' Sign in before your next visit and the badge can be attached to your account.'}
      </p>
      <a href="/" className="mt-6 inline-block py-1 text-accent hover:underline">
        Back to reading →
      </a>
    </main>
  );
}
