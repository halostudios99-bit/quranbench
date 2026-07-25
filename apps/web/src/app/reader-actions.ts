'use server';

import {
  DISPLAY_MODES,
  ARABIC_SIZES,
  type ReaderPrefs,
} from '@/lib/reader-prefs';
import { getCurrentUser } from '@/server/auth';
import { listTranslationEditions } from '@/server/corpus';
import { prismaStore } from '@/server/store-prisma';

// Mirror the reader's view preferences to their profile so the same choices follow
// them across devices. Called by the reader toolbar when a signed-in reader changes
// a control (the cookie is always written client-side too). A no-op when signed
// out — this never gates content, it only records a preference.

export async function saveReaderPrefs(prefs: ReaderPrefs): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  // Validate against the real editions and the known enums — never trust the
  // client payload verbatim into storage.
  const available = new Set(listTranslationEditions().map((e) => e.id));
  const editions = Array.isArray(prefs.editions)
    ? prefs.editions.filter((id) => available.has(id))
    : undefined;
  const display = DISPLAY_MODES.includes(prefs.display) ? prefs.display : 'both';
  const size = ARABIC_SIZES.includes(prefs.size) ? prefs.size : 2;

  try {
    await prismaStore.setReaderPrefs(user.id, { editions, display, size });
  } catch {
    // Best-effort: the cookie already carries the choice.
  }
}
