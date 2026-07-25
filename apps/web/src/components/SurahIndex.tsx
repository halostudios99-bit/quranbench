import { listSurahs } from '@/server/corpus';
import { surahHref } from '@/lib/addressing';

// Server-rendered surah navigation: 114 real links, crawlable, no JavaScript.
export function SurahIndex() {
  const surahs = listSurahs();
  return (
    <nav aria-label="All surahs">
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {surahs.map((surah) => (
          <li key={surah.number}>
            <a
              href={surahHref(surah.number)}
              className="flex items-center gap-3 rounded-lg border border-line bg-panel px-4 py-3 hover:border-line2"
            >
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-soft text-[13px] text-ink2">
                {surah.number}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium text-ink">
                  {surah.name_en}
                </span>
                <span className="block text-[12px] text-ink3">
                  {surah.name_translit} · {surah.verse_count} verses
                </span>
              </span>
              <span lang="ar" dir="rtl" className="quran text-[24px] leading-none text-ink2">
                {surah.name_ar}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
