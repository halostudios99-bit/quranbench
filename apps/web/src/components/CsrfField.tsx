import { CSRF_FIELD, csrfToken } from '@/server/security/csrf';

// A hidden CSRF token field for a state-changing form. Async server component: it
// reads the per-browser token issued by middleware and renders it, so a native
// (no-JavaScript) form post carries the double-submit token. Place inside any
// <form> that targets a route handler; client forms driven by useActionState take
// the token as a prop instead (the token is a string, so it crosses the boundary).
export async function CsrfField() {
  const token = await csrfToken();
  return <input type="hidden" name={CSRF_FIELD} value={token} />;
}
