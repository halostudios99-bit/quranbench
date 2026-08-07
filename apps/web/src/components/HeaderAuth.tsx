'use client';

import { useEffect, useState } from 'react';

// The header's signed-in indicator. Rendered as progressive enhancement so
// public pages stay static: the server renders the signed-out links, and this
// swaps in the account controls once the session summary loads. Nothing here
// gates content — it only personalises the header.
//
// Sign-out is a LINK to /signout, not an inline form. The action requires the
// CSRF token, which only a server render can embed (the cookie is httpOnly);
// an inline form here posted without it and the action silently declined —
// the sign-out button that did nothing. /signout renders the token and works
// with JavaScript off, exactly like every other auth form.

type Session =
  | { signedIn: true; handle: string; emailVerified: boolean }
  | { signedIn: false };

const linkClass = 'rounded-md px-2.5 py-2 text-[14px] text-ink2 hover:text-ink';

// The header renders twice — once inline for wide viewports, once inside the
// mobile disclosure menu — and only one is ever visible. Both mount, so the
// session lookup is shared here rather than fired twice per page load. The
// cache expires after a few seconds: sign-out navigates without a full page
// load, and a forever-memo kept showing the old session in the header.
let sessionRequest: Promise<Session> | null = null;
let sessionAt = 0;
function loadSession(): Promise<Session> {
  if (!sessionRequest || Date.now() - sessionAt > 3000) {
    sessionAt = Date.now();
    sessionRequest = fetch('/api/session', {
      headers: { accept: 'application/json' },
    })
      .then((r) =>
        r.ok ? (r.json() as Promise<Session>) : { signedIn: false as const },
      )
      .catch(() => ({ signedIn: false as const }));
  }
  return sessionRequest;
}

function SignedOut({ stacked }: { stacked: boolean }) {
  return (
    <>
      <a href="/signin" className={stacked ? `${linkClass} block` : linkClass}>
        Sign in
      </a>
      <a
        href="/signup"
        className={`rounded-md bg-accent px-3 py-2 text-[14px] font-medium text-on-accent hover:opacity-90 ${
          stacked ? 'block text-center' : ''
        }`}
      >
        {/* "Create account" is 87px wide and was the label that pushed the
            header past the viewport. In the stacked menu there is room for it;
            inline there is not. */}
        <span className={stacked ? '' : 'sm:hidden'}>Sign up</span>
        <span className={stacked ? 'hidden' : 'hidden sm:inline'}>Create account</span>
      </a>
    </>
  );
}

/**
 * @param stacked laid out vertically inside the mobile menu rather than inline.
 */
export function HeaderAuth({ stacked = false }: { stacked?: boolean }) {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let active = true;
    void loadSession().then((data) => {
      if (active) setSession(data);
    });
    return () => {
      active = false;
    };
  }, []);

  // Before hydration resolves, show the signed-out controls: they are always
  // safe and never gate anything.
  if (!session || !session.signedIn) return <SignedOut stacked={stacked} />;

  return (
    <>
      <a
        href="/account"
        className={`${linkClass} font-medium text-ink ${stacked ? 'block' : ''}`}
      >
        @{session.handle}
      </a>
      <a
        href="/signout"
        className={stacked ? `${linkClass} block` : linkClass}
      >
        Sign out
      </a>
    </>
  );
}
