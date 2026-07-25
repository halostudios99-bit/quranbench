// The session cookie policy, as a pure function so its attributes can be tested
// with no request context. httpOnly keeps the token out of JavaScript; secure
// (in production) keeps it off plaintext HTTP; sameSite=lax blocks CSRF on
// cross-site POSTs while still allowing top-level navigation from a link — the
// attributes CLAUDE.md mandates for sessions.

export const SESSION_COOKIE = 'qb_session';

export interface SessionCookieAttributes {
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax';
  path: '/';
  expires: Date;
}

export function sessionCookieAttributes(
  expires: Date,
  secure: boolean,
): SessionCookieAttributes {
  return { httpOnly: true, secure, sameSite: 'lax', path: '/', expires };
}
