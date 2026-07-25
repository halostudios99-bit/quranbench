'use client';

import { useEffect, useState } from 'react';

import { signoutAction } from '@/app/(auth)/actions';

// The header's signed-in indicator. Rendered as progressive enhancement so
// public pages stay static: the server renders the signed-out links, and this
// swaps in the account controls once the session summary loads. Nothing here
// gates content — it only personalises the header.

type Session =
  | { signedIn: true; handle: string; emailVerified: boolean }
  | { signedIn: false };

const linkClass = 'rounded-md px-2.5 py-2 text-[14px] text-ink2 hover:text-ink';

function SignedOut() {
  return (
    <>
      <a href="/signin" className={linkClass}>
        Sign in
      </a>
      <a
        href="/signup"
        className="rounded-md border border-line px-2.5 py-2 text-[14px] text-ink hover:border-line2"
      >
        Create account
      </a>
    </>
  );
}

export function HeaderAuth() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/session', { headers: { accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : { signedIn: false }))
      .then((data: Session) => {
        if (active) setSession(data);
      })
      .catch(() => active && setSession({ signedIn: false }));
    return () => {
      active = false;
    };
  }, []);

  // Before hydration resolves, show the signed-out controls: they are always
  // safe and never gate anything.
  if (!session || !session.signedIn) return <SignedOut />;

  return (
    <>
      <a href="/account" className={`${linkClass} font-medium text-ink`}>
        @{session.handle}
      </a>
      <form action={signoutAction}>
        <button type="submit" className={linkClass}>
          Sign out
        </button>
      </form>
    </>
  );
}
