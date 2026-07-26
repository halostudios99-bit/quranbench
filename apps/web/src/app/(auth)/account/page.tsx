import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/server/auth';
import { getAccountView } from '@/server/research';
import { csrfToken } from '@/server/security/csrf';

import { ResendVerification } from './ResendVerification';
import { alertClass, noticeStyle } from '../form-styles';

export const metadata: Metadata = {
  title: 'Your account',
  robots: { index: false, follow: false },
};

const dateFmt = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
});

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  OPEN: 'Published',
  CONTESTED: 'Contested',
  REVISED: 'Revised',
  WITHDRAWN: 'Withdrawn',
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ verified?: string; welcome?: string }>;
}) {
  const current = await getCurrentUser();
  if (!current) redirect('/signin');
  const view = await getAccountView(current.id);
  if (!view) redirect('/signin');

  const { user, termsAcceptances, investigations } = view;
  const verified = user.emailVerified !== null;
  const params = await searchParams;

  return (
    <section className="mx-auto max-w-reader">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-ink">
        Your account
      </h1>

      {params.verified ? (
        <p className={`mb-4 ${alertClass}`} style={noticeStyle} role="status">
          Your email address is verified. You can now publish investigations.
        </p>
      ) : null}
      {params.welcome && !verified ? (
        <p className={`mb-4 ${alertClass}`} style={noticeStyle} role="status">
          Account created. Check your email for the verification link — in
          development it is written to the server console.
        </p>
      ) : null}

      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-md border border-line bg-panel p-4 sm:grid-cols-[10rem_1fr]">
        <dt className="text-[14px] text-ink3">Handle</dt>
        <dd className="text-[15px] font-medium text-ink">@{user.handle}</dd>

        <dt className="text-[14px] text-ink3">Real name</dt>
        <dd className="text-[15px] text-ink">{user.displayName ?? '—'}</dd>

        <dt className="text-[14px] text-ink3">Email</dt>
        <dd className="text-[15px] text-ink">{user.email}</dd>

        <dt className="text-[14px] text-ink3">Email verified</dt>
        <dd className="text-[15px] text-ink">
          {verified ? (
            <>Yes · {dateFmt.format(user.emailVerified!)} UTC</>
          ) : (
            <span className="text-ink2">
              Not yet — verification is required before publishing.
            </span>
          )}
        </dd>

        <dt className="text-[14px] text-ink3">Contributor terms</dt>
        <dd className="text-[15px] text-ink">
          {termsAcceptances.length === 0 ? (
            '—'
          ) : (
            <ul className="space-y-1">
              {termsAcceptances.map((a) => (
                <li key={`${a.version}-${a.acceptedAt.toISOString()}`}>
                  Version {a.version} · accepted {dateFmt.format(a.acceptedAt)}{' '}
                  UTC
                </li>
              ))}
            </ul>
          )}
        </dd>
      </dl>

      {!verified ? (
        <div className="mt-4">
          <ResendVerification csrf={await csrfToken()} />
        </div>
      ) : null}

      <h2 className="mb-3 mt-8 text-lg font-semibold text-ink">
        Your investigations
      </h2>
      {investigations.length === 0 ? (
        <p className="text-[15px] text-ink2">
          You have no investigations yet. Drafting is open; publishing needs a
          verified email, a working query and stated counter-evidence.
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-md border border-line bg-panel">
          {investigations.map((inv) => (
            <li
              key={inv.id}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <a
                href={`/investigations/${inv.slug}`}
                className="text-[15px] text-ink hover:text-accent"
              >
                {inv.claim.trim() || (
                  <span className="text-ink3">(no claim yet)</span>
                )}
              </a>
              <span className="shrink-0 text-[13px] text-ink3">
                {STATUS_LABEL[inv.status] ?? inv.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
