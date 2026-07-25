import { Icon } from './Icon';
import { SearchShortcut } from './SearchShortcut';

// A real GET form: search works with JavaScript disabled — submitting navigates
// to the server-rendered /search page. The chips are plain links, not scripts.

const CHIPS: { label: string; q: string; highlight?: boolean }[] = [
  { label: 'root: ز ك و', q: 'root:ز ك و', highlight: true },
  { label: 'zakat NEAR/10 salah', q: 'الزكوة NEAR/10 الصلوة' },
  { label: 'pattern: مف*ول', q: 'pattern:مف*ول' },
  { label: 'root: ق و م AND surah:2', q: 'root:ق و م AND surah:2' },
];

export function SearchBar({ defaultValue = '' }: { defaultValue?: string }) {
  return (
    <div>
      <form
        action="/search"
        method="get"
        role="search"
        className="flex max-w-2xl flex-col gap-2 sm:flex-row"
      >
        <div className="flex flex-1 items-center gap-3 rounded-lg border border-line2 bg-panel px-4 focus-within:border-accent">
          <span className="text-ink3" aria-hidden="true">
            <Icon name="search" size={18} />
          </span>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={defaultValue}
            placeholder="Arabic word, root, or query…"
            aria-label="Search the Quran corpus"
            autoComplete="off"
            className="h-13 min-h-[52px] w-full bg-transparent py-3 text-[16px] text-ink outline-none placeholder:text-ink3"
          />
        </div>
        <button
          type="submit"
          className="flex h-[52px] items-center justify-center rounded-lg bg-accent px-6 text-[15px] font-medium text-on-accent"
        >
          Search
        </button>
      </form>
      <div className="mt-4 flex flex-wrap gap-2">
        {CHIPS.map((chip) => (
          <a
            key={chip.label}
            href={`/search?q=${encodeURIComponent(chip.q)}`}
            dir="auto"
            className={
              chip.highlight
                ? 'rounded-full border border-accent-line bg-accent-bg px-3 py-1.5 text-[13px] text-accent'
                : 'rounded-full border border-transparent bg-soft px-3 py-1.5 text-[13px] text-ink2 hover:border-line2'
            }
          >
            {chip.label}
          </a>
        ))}
      </div>
      <SearchShortcut />
    </div>
  );
}
