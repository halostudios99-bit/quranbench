'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

// Reader control for which translation editions are shown. Persists to a cookie
// (no account needed), then refreshes so the server re-renders the chosen editions
// — the content itself is server-rendered and works with JavaScript disabled; this
// control only changes the preference. Follows the hydration-guard pattern used by
// ThemeToggle so it never mismatches on first paint.

const TRANSLATION_COOKIE = 'qb_translations';
const ONE_YEAR = 60 * 60 * 24 * 365;

interface EditionOption {
  id: string;
  translator: string;
  year: number;
}

function readCookie(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)qb_translations=([^;]*)/);
  return match ? decodeURIComponent(match[1]!) : null;
}

function writeCookie(value: string): void {
  document.cookie = `${TRANSLATION_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
}

/** Which editions are selected, given the cookie value and the full edition list. */
function selected(cookie: string | null, all: string[]): Set<string> {
  if (cookie === null || cookie === 'all') return new Set(all);
  if (cookie === 'none') return new Set();
  return new Set(cookie.split(',').filter((id) => all.includes(id)));
}

export function TranslationSettings({ editions }: { editions: EditionOption[] }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [chosen, setChosen] = useState<Set<string>>(new Set(editions.map((e) => e.id)));

  const allIds = editions.map((e) => e.id);

  useEffect(() => {
    setMounted(true);
    setChosen(selected(readCookie(), allIds));
    // allIds is derived from a stable prop; run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function apply(next: Set<string>): void {
    setChosen(next);
    const value =
      next.size === allIds.length ? 'all' : next.size === 0 ? 'none' : allIds.filter((id) => next.has(id)).join(',');
    writeCookie(value);
    router.refresh();
  }

  function toggle(id: string): void {
    const next = new Set(chosen);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    apply(next);
  }

  // Before hydration, render nothing interactive — the server already rendered the
  // translations themselves, so no content is lost with JS off.
  if (!mounted) return null;

  return (
    <details className="rounded-lg border border-line bg-panel px-4 py-3 text-[13px]">
      <summary className="cursor-pointer text-ink2">
        Translations shown ({chosen.size}/{editions.length})
      </summary>
      <fieldset className="mt-3 flex flex-col gap-2">
        <legend className="sr-only">Choose which translation editions to show</legend>
        {editions.map((e) => (
          <label key={e.id} className="flex items-center gap-2 text-ink2">
            <input
              type="checkbox"
              checked={chosen.has(e.id)}
              onChange={() => toggle(e.id)}
              className="h-4 w-4"
            />
            <span>
              {e.translator} <span className="text-ink3">({e.year})</span>
            </span>
          </label>
        ))}
      </fieldset>
    </details>
  );
}
