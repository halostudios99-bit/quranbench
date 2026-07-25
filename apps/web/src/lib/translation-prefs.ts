import 'server-only';

import { cookies } from 'next/headers';

// Which translation editions a reader wants shown, persisted without an account.
// Stored in a cookie so it survives across visits and is readable server-side —
// the pages render the chosen editions with no JavaScript. Default (no cookie) is
// to show every available edition.

export const TRANSLATION_COOKIE = 'qb_translations';

/**
 * Resolve the reader's selected edition ids from the cookie, intersected with what
 * is actually available. Returns `undefined` to mean "show all" (the default and
 * the `all` sentinel); `[]` means the reader hid every edition.
 */
export async function selectedTranslationEditions(
  available: string[],
): Promise<string[] | undefined> {
  const store = await cookies();
  const raw = store.get(TRANSLATION_COOKIE)?.value;
  if (!raw || raw === 'all') return undefined;
  if (raw === 'none') return [];
  const set = new Set(available);
  const chosen = raw.split(',').filter((id) => set.has(id));
  return chosen;
}
