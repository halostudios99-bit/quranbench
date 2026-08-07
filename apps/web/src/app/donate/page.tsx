import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/server/auth';
import {
  MAX_AMOUNT,
  MIN_AMOUNT,
  PRESET_AMOUNTS,
  createDonationCheckout,
  stripeConfigured,
  supporterCount,
} from '@/server/donations';

export const metadata: Metadata = {
  title: 'Support — QuranBench',
  description:
    'Support the running of QuranBench with a one-off personal gift to the maintainer.',
};

// One page, one honest sentence: this is a personal gift to the maintainer,
// not a charitable donation, and it buys nothing — every part of the site
// stays free and ungated. Supporters get a badge as a thank-you.

async function donate(formData: FormData) {
  'use server';
  const preset = formData.get('amount');
  const custom = formData.get('custom');
  const pounds = Number(preset === 'custom' ? custom : preset);
  const amountCents = Math.round(pounds * 100);
  if (!Number.isFinite(amountCents)) return;
  if (amountCents < MIN_AMOUNT || amountCents > MAX_AMOUNT) return;

  const user = await getCurrentUser();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://quranbench.com';
  const url = await createDonationCheckout({
    amountCents,
    userId: user?.id,
    siteUrl,
  });
  redirect(url);
}

export default async function DonatePage() {
  const user = await getCurrentUser();
  const configured = stripeConfigured();
  // Shown only once real: a fake or padded number here would poison the one
  // page whose entire argument is honesty.
  const supporters = await supporterCount().catch(() => 0);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-[28px] font-semibold text-ink">Support QuranBench</h1>
      <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink2">
        QuranBench is free, open and without ads, and will stay that way. If it
        is useful to you, a one-off gift helps cover the server and the time.
      </p>
      <p className="mt-3 max-w-prose text-[14px] leading-relaxed text-ink3">
        Plainly: this is a personal gift to the site&rsquo;s maintainer, not a
        charitable donation — there is no registered charity behind it and no
        tax relief applies. A gift buys nothing: every page, translation and
        download stays free for everyone. Signed-in supporters receive a badge
        on their account as a thank-you.
      </p>
      {supporters > 0 ? (
        <p className="mt-3 text-[14px] text-ink2">
          {supporters.toLocaleString()} gift{supporters === 1 ? '' : 's'} so
          far — thank you.
        </p>
      ) : null}

      {configured ? (
        <form action={donate} className="mt-8 flex flex-col gap-4">
          <fieldset className="flex flex-wrap gap-3">
            <legend className="mb-2 text-[15px] font-semibold text-ink">
              Amount
            </legend>
            {PRESET_AMOUNTS.map((cents, i) => (
              <label
                key={cents}
                className="cursor-pointer rounded-lg border border-line bg-panel px-5 py-3 text-[15px] text-ink has-[:checked]:border-accent"
              >
                <input
                  type="radio"
                  name="amount"
                  value={cents / 100}
                  defaultChecked={i === 1}
                  className="sr-only"
                />
                £{(cents / 100).toFixed(0)}
              </label>
            ))}
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-panel px-4 py-3 text-[15px] text-ink has-[:checked]:border-accent">
              <input type="radio" name="amount" value="custom" className="sr-only" />
              <span>Other £</span>
              <input
                type="number"
                name="custom"
                min={MIN_AMOUNT / 100}
                max={MAX_AMOUNT / 100}
                step="1"
                className="w-20 rounded border border-line bg-bg px-2 py-1 text-[15px]"
                aria-label="Custom amount in pounds"
              />
            </label>
          </fieldset>
          <button
            type="submit"
            className="w-fit rounded-lg bg-accent px-6 py-3 text-[15px] font-semibold text-white hover:opacity-90"
          >
            Give via Stripe
          </button>
          {!user ? (
            <p className="text-[13px] text-ink3">
              You can give without an account.{' '}
              <a href="/signin" className="inline-block py-1 text-accent hover:underline">
                Sign in first
              </a>{' '}
              if you&rsquo;d like the supporter badge on your profile.
            </p>
          ) : null}
        </form>
      ) : (
        <div className="mt-8 rounded-xl border border-line bg-panel px-5 py-5">
          <p className="text-[16px] font-semibold text-ink">
            Donations are coming soon.
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-ink2">
            The payment account is still being set up. Nothing is being
            collected yet — this page will take gifts the moment it is ready.
            Meanwhile, the whole site is and will remain free.
          </p>
        </div>
      )}
    </main>
  );
}
