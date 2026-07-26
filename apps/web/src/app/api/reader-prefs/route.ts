import { NextResponse, type NextRequest } from 'next/server';

import {
  DISPLAY_COOKIE,
  parseDisplay,
  parseSize,
  serialiseEditions,
  SIZE_COOKIE,
  TRANSLATION_COOKIE,
  type ReaderPrefs,
} from '@/lib/reader-prefs';
import { getCurrentUser } from '@/server/auth';
import { listTranslationEditions } from '@/server/corpus';
import { prismaStore } from '@/server/store-prisma';

// The no-JavaScript half of the reader controls. The reader toolbar degrades to a
// plain GET form that submits here; this sets the preference cookies (and mirrors
// them to the account when signed in) and redirects back to the page the reader
// came from, which re-renders server-side with the new preferences applied. With
// JavaScript the toolbar sets the same cookies directly and never navigates here.

export const dynamic = 'force-dynamic';

const ONE_YEAR = 60 * 60 * 24 * 365;

/** Only same-origin absolute paths are honoured as a return target. */
function safeReturn(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/';
  return raw;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const available = listTranslationEditions().map((e) => e.id);
  const availableSet = new Set(available);
  const chosen = new Set(
    params.getAll('edition').filter((id) => availableSet.has(id)),
  );
  const editionsValue = serialiseEditions(chosen, available);
  const display = parseDisplay(params.get('display'));
  const size = parseSize(params.get('size'));

  const response = NextResponse.redirect(
    new URL(safeReturn(params.get('return')), request.url),
    { status: 303 },
  );
  const attributes = {
    path: '/',
    maxAge: ONE_YEAR,
    sameSite: 'lax' as const,
  };
  response.cookies.set(TRANSLATION_COOKIE, editionsValue, attributes);
  response.cookies.set(DISPLAY_COOKIE, display, attributes);
  response.cookies.set(SIZE_COOKIE, String(size), attributes);

  // Mirror to the account so the choice follows a signed-in reader across devices.
  const user = await getCurrentUser();
  if (user) {
    // Store the resolved list explicitly, even when it is every edition. An
    // absent `editions` in a profile means "never chosen" and resolves to the
    // default single edition, so writing `undefined` here for a reader who
    // deliberately ticked everything would silently undo their choice.
    const prefs: ReaderPrefs = {
      editions: available.filter((id) => chosen.has(id)),
      display,
      size,
    };
    try {
      await prismaStore.setReaderPrefs(user.id, prefs);
    } catch {
      // Persisting to the profile is best-effort; the cookie already carries the
      // choice, so a database hiccup must not fail the request.
    }
  }

  return response;
}
