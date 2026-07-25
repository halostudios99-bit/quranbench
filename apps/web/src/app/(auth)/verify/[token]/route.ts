import { redirect } from 'next/navigation';

import { getCurrentUser, rotateSessionCookie } from '@/server/auth';
import { verifyEmailToken } from '@/server/research';

// Email verification runs here, in a route handler, because verifying is a
// side-effecting GET that must set a cookie — neither is allowed during a page
// render. The link comes from the email, so it is never prefetched. Verifying is
// what unlocks publishing (the publish gate checks emailVerified).

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const result = await verifyEmailToken(token);
  if (!result.ok) redirect('/signin?verify=invalid');

  // Verifying is a privilege change: if this is the signed-in user's own link,
  // rotate their session so a pre-verification token cannot be replayed. On a
  // different device we do not silently sign them in — send them to sign in.
  const current = await getCurrentUser();
  if (current && current.id === result.userId) {
    await rotateSessionCookie(current.id);
    redirect('/account?verified=1');
  }
  redirect('/signin?verified=1');
}
