import 'server-only';

import { cookies } from 'next/headers';

import {
  DEFAULT_READER_PREFS,
  DISPLAY_COOKIE,
  normaliseReaderPrefs,
  parseDisplay,
  parseEditions,
  parseSize,
  SIZE_COOKIE,
  TRANSLATION_COOKIE,
  type ReaderPrefs,
} from '@/lib/reader-prefs';
import { getCurrentUser } from './auth';
import type { User } from './domain/types';
import { prismaStore } from './store-prisma';

// Resolve the reading preferences for the current request. Preferences are stored
// in cookies for anyone (no account needed) and mirrored to the profile when
// signed in, so the same choices follow a reader across devices. Reading these
// cookies is what makes the reader routes render per-reader — but every edition is
// still rendered server-side and the content is complete with JavaScript disabled;
// the preference only chooses what a given reader sees.
//
// Precedence: a signed-in reader's saved profile preferences win (they are the
// cross-device source of truth); otherwise the cookies; otherwise the defaults
// (all editions, Arabic + translation, medium size).

/**
 * The reader's preferences for this request, resolved against the editions that
 * actually exist. `editions` is `undefined` for "show all" (the default).
 */
export async function readerPreferences(
  available: string[],
  currentUser?: User | null,
): Promise<ReaderPrefs> {
  const fromCookie = await readerPrefsFromCookies(available);

  // A signed-in reader with saved preferences: the account is authoritative. The
  // caller may pass an already-resolved user to avoid a second session lookup.
  const user = currentUser !== undefined ? currentUser : await getCurrentUser();
  if (user) {
    try {
      const stored = await prismaStore.getReaderPrefs(user.id);
      if (stored != null) return normaliseReaderPrefs(stored, available);
    } catch {
      // A database hiccup must never break a public reader page — fall back to
      // the cookie-derived preferences (or defaults).
    }
  }
  return fromCookie;
}

async function readerPrefsFromCookies(available: string[]): Promise<ReaderPrefs> {
  const store = await cookies();
  return {
    editions: parseEditions(store.get(TRANSLATION_COOKIE)?.value, available),
    display: parseDisplay(store.get(DISPLAY_COOKIE)?.value),
    size: parseSize(store.get(SIZE_COOKIE)?.value),
  };
}

export { DEFAULT_READER_PREFS };
