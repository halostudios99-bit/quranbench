import { NextResponse } from 'next/server';

import { clientId, getCurrentUser } from '@/server/auth';
import { submitCorrection } from '@/server/research';

// The correction endpoint. A plain POST target for the report form, so submission
// works without JavaScript: the browser posts the form natively and we redirect —
// to the thank-you page on success, or back to the form with the error and the
// entered values on failure (303 → the browser GETs the target). A Route Handler,
// not a Server Action, so cookies/headers resolve in a normal request scope even
// for a no-JS native form post. No account is required.
export const dynamic = 'force-dynamic';

function str(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === 'string' ? v : '';
}

export async function POST(request: Request): Promise<NextResponse> {
  const form = await request.formData();
  const path = str(form, 'path');
  const problem = str(form, 'problem');
  const correction = str(form, 'correction');
  const contact = str(form, 'contact');

  const user = await getCurrentUser();
  const result = await submitCorrection({
    path,
    problem,
    correction: correction || null,
    contact: contact || null,
    reporterId: user?.id ?? null,
    clientId: await clientId(),
  });

  if (result.ok)
    return NextResponse.redirect(new URL('/report/thanks', request.url), 303);

  // Preserve what the reporter typed so a failed submit never loses their work.
  const params = new URLSearchParams({ error: result.code });
  if (path) params.set('path', path);
  if (problem) params.set('problem', problem);
  if (correction) params.set('correction', correction);
  if (contact) params.set('contact', contact);
  return NextResponse.redirect(new URL(`/report?${params.toString()}`, request.url), 303);
}
