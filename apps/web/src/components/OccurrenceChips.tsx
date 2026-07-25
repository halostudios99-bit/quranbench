import type { OccurrenceRef } from '@/server/corpus';

// A compact, linkable list of occurrences shown as reference chips. These are
// deliberately NOT rendered through the Token or Verse renderers: they are
// navigation, not a second surface for scripture, so the one-renderer rule is
// preserved and the page stays light even when a word occurs thousands of times.
// Each chip links to the occurrence's word page; its reference links to the verse.
export function OccurrenceChips({ items }: { items: OccurrenceRef[] }) {
  return (
    <ul className="flex flex-wrap gap-2" data-testid="occurrence-chips">
      {items.map((o) => (
        <li key={o.tokenId}>
          <a
            href={o.wordHref}
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-panel px-3 py-1.5 hover:border-line2"
          >
            <span
              lang="ar"
              dir="rtl"
              className="quran text-[24px] leading-none text-ink"
            >
              {o.text}
            </span>
            <span className="font-ui text-[12px] text-ink3">{o.ref}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
