import 'server-only';

import { getCurrentUser } from '@/server/auth';
import { listTranslationEditions } from '@/server/corpus';
import { readerPreferences } from '@/server/reader-prefs';
import type { ReaderPrefs } from '@/lib/reader-prefs';
import { ReaderToolbar } from './ReaderToolbar';

// Resolve the reading preferences for the current request and build the reader
// toolbar in one place, so every reader surface (surah, paginated, single verse)
// stays consistent. Reading the preference cookies is what makes these routes
// render per-reader; every edition is still rendered server-side, so the content
// is complete and crawlable with JavaScript disabled — the preference only chooses
// what a given reader sees.

export interface ReaderView {
  toolbar: React.ReactNode;
  prefs: ReaderPrefs;
}

export async function resolveReaderView(returnPath: string): Promise<ReaderView> {
  const editions = listTranslationEditions();
  const editionIds = editions.map((e) => e.id);
  const user = await getCurrentUser();
  const prefs = await readerPreferences(editionIds, user);

  const toolbar =
    editions.length > 0 ? (
      <ReaderToolbar
        editions={editions.map((e) => ({
          id: e.id,
          translator: e.translator,
          year: e.year,
          licence: e.licence,
          language: e.language,
        }))}
        prefs={prefs}
        signedIn={user !== null}
        returnPath={returnPath}
      />
    ) : null;

  return { toolbar, prefs };
}
