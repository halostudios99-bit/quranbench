import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/server/auth';

// A tiny session-summary endpoint for the header. It exists so public pages stay
// statically renderable: reading the session cookie in the root layout would opt
// every page into dynamic rendering, but the signed-in indicator is chrome, not
// content. The header fetches this after hydration; signed-out users (and any
// no-JS client) still see the working "Sign in" link the header renders on its
// own. No content is ever gated on this — it only personalises the header.

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  const body = user
    ? {
        signedIn: true as const,
        handle: user.handle,
        emailVerified: user.emailVerified !== null,
      }
    : { signedIn: false as const };
  return NextResponse.json(body, {
    headers: { 'cache-control': 'no-store' },
  });
}
