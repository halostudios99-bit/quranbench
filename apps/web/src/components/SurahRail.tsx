import { surahHref } from '@/lib/addressing';
import { listSurahs } from '@/server/corpus';
import { SurahRailFilter } from './SurahRailFilter';

// The persistent surah navigation beside the reader: 114 real links, rendered on
// the server, crawlable, and working with JavaScript disabled.
//
// It is desktop-only (`lg:` and up) and that is deliberate rather than a gap. A
// 114-item list on a phone would either bury the first ayah or need a JavaScript
// drawer, and a drawer cannot be the only route to the surah list on a site whose
// rule is that every page works without JavaScript. On small screens the reader's
// breadcrumb already links to `/`, which renders the complete surah index.
//
// The list markup is the single source of truth: the filter is a client component
// that hides list items in the DOM, so no surah data is serialised into the page
// payload a second time.

export function SurahRail({ currentSurah }: { currentSurah: number }) {
  const surahs = listSurahs();

  return (
    <aside className="hidden w-72 shrink-0 lg:block" data-testid="surah-rail">
      <nav
        aria-label="All surahs"
        className="sticky top-8 max-h-[calc(100vh-5rem)] overflow-auto pe-1"
      >
        <p className="px-2 pb-2.5 text-[11px] font-semibold uppercase tracking-wider text-ink3">
          All surahs
        </p>

        <SurahRailFilter />

        <ul data-surah-list>
          {surahs.map((surah) => {
            const current = surah.number === currentSurah;
            return (
              <li
                key={surah.number}
                data-surah-item
                // Pre-lowercased haystack so the filter never has to read layout
                // or reason about the rendered text.
                data-surah-search={`${surah.number} ${surah.name_en} ${surah.name_translit}`.toLowerCase()}
              >
                <a
                  href={surahHref(surah.number)}
                  aria-current={current ? 'page' : undefined}
                  className={`flex items-center gap-3 rounded-lg border px-2.5 py-2 ${
                    current
                      ? 'border-accent-line bg-accent-bg'
                      : 'border-transparent hover:bg-soft'
                  }`}
                >
                  <span className="w-6 shrink-0 text-[12px] tabular-nums text-ink3">
                    {surah.number}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] text-ink">
                      {surah.name_en}
                    </span>
                    {/* ink2 rather than ink3: on the current row's accent
                        background, ink3 at 12px falls under the 4.5:1 minimum. */}
                    <span
                      className={`block text-[11.5px] ${current ? 'text-ink2' : 'text-ink3'}`}
                    >
                      {surah.name_translit} · {surah.verse_count} verses
                    </span>
                  </span>
                  <span
                    lang="ar"
                    dir="rtl"
                    className="quran shrink-0 text-[17px] leading-none text-ink2"
                  >
                    {surah.name_ar}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>

        <p
          data-surah-empty
          hidden
          className="px-2 py-3 text-[13px] text-ink3"
          role="status"
        >
          No surah matches that.
        </p>
      </nav>
    </aside>
  );
}
