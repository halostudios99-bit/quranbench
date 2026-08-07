// The site logo: الله with its marks — shadda and dagger alif above the lams,
// damma on the heh — set in the site's own Amiri Quran typeface. The base is
// HarfBuzz-shaped; the marks are hand-placed for a compact lockup (Amiri's
// mushaf-style stacking is far too tall for a header). Frozen as a vector
// outline: no font load, no fallback rendering, identical everywhere. Inline
// SVG with currentColor so it follows the theme; works with JavaScript off.

const ALLAH_PATH =
  'M43.3 118.6Q45.3 118.6 46.1 122.4Q47 126.1 46.1 129.8Q45.3 133.6 43.4 133.7Q31.1 135 28.2 120.1Q28 119.6 28 119.2Q23.3 126.2 20.8 126.7Q8.2 129 1.6 124.4Q-0.8 122.6 0.4 119.1Q3 110.7 10.2 104.8Q17.5 98.8 25.6 96.9L25.3 89.9Q25.3 88.7 27.7 83.6Q29 81.1 29.8 79.6Q30.5 78.1 30.6 77.8Q32.2 75.2 32.5 79.7Q32.5 80.6 32.6 83.1Q32.6 85.7 32.8 90.2Q32.9 94.6 33.1 98.7Q33.3 102.8 33.8 106.8Q34.6 114.7 38.4 117.3Q40.1 118.6 43.3 118.6ZM25.9 103.8Q24.4 104.1 22.4 104.9Q20.4 105.7 17.8 107Q12.7 109.6 11.2 112.3Q13.5 114 21.3 113.7Q25.2 113.5 26.7 111.7Q26.6 111 26.4 109Q26.2 107 25.9 103.8ZM77 117.3Q79.6 117.8 80.5 121.8Q81.3 125.8 80.5 129.7Q79.6 133.7 78.3 133.7Q72.4 133.9 68.1 130.1Q64.2 126.7 60.2 119.1Q58.1 124.1 56.2 127.2Q54.3 130.3 52.6 131.3Q48.9 133.4 43.6 133.6Q40.2 133.9 38.5 129.8Q36.8 126 37.8 122.4Q39 118.6 43.4 118.6Q53.8 118.6 56.9 111.4Q56.9 111.4 56.7 109.9Q56.5 108.3 55.9 105.1L52.7 88.9Q51.7 83.9 51.2 80.5Q50.6 77.1 50.3 75.2Q49.9 71.5 50.9 70.1L55 63.5Q56.5 61.4 57.3 65.2Q57.6 66 58.1 68.7Q58.5 71.4 59.1 75.7Q63.7 105 67.1 110.7Q70.6 116.5 77 117.3ZM79.2 65.3 86.5 99.1Q87.2 102.8 87.7 105.4Q88.2 108 88.4 109.6Q88.5 111 88.5 112.7Q88.5 114.5 88.2 116.5Q86.5 133.7 78.2 133.7Q73.7 133.7 70.9 127.7Q68.1 121.6 70.4 119.1Q72.9 116.3 76 117.2Q79.5 118.1 81.9 116.9Q81.8 115.2 80.8 110.6Q79.9 106 78.2 98.7Q74.7 84.3 73 74.2Q72.4 70.4 76.9 63.9Q78.3 61.6 79.2 65.3ZM110.1 37.6Q113.1 30.6 114 37.3L117.3 72.5Q122.7 120.1 116 132.9Q115 134.6 114.4 133.7Q113.8 133 113.8 131.3Q114.1 119.2 112.1 104.1Q112.1 103.5 109.1 76.8L105.9 50.8Q105.6 47.9 106.5 45.9ZM75.4 22Q75.7 19.6 77 19.9Q78.5 20 78.4 22Q78.1 27.4 76.3 31.3Q74.3 35.7 70.5 35.9Q68.2 36.2 66 33.5Q65.3 34.8 64.3 35.7Q63.3 36.7 62.1 37.4Q59.4 38.8 56.9 37.6Q51 35.2 55.6 23.1Q56.4 21.3 57.8 22Q59 22.5 58.5 24.2Q56.8 30.2 60 30.8Q63.9 31.1 66.2 22.4Q66.6 20.5 67.8 20.9Q69.2 21.2 68.8 22.5Q67.9 27.7 71.4 27.7Q74.8 27.7 75.4 22ZM61.7 -5.7Q62.3 -7.5 63.9 -5.5Q75.5 7.4 71.8 27.2Q71.7 28.3 70.6 28.5Q69.6 28.7 69.4 27.2Q67.7 14.4 60 4.8Q59 3.7 59.4 2.2ZM20.7 8.1Q21.9 7.9 22.9 9.4Q24.8 12.4 22.9 17.4Q23.6 17.7 23.9 18Q24.3 18.3 24.7 18.4Q25.7 18.8 25.1 20L24.2 21.6Q23.8 22.4 23.1 22.1Q22.3 21.9 21.1 21.2Q15.6 28.2 8.8 31.6Q7.4 32.4 6.8 31.4Q6.2 30.2 7.9 29.4Q14.8 25.3 19 20Q16.7 18.8 15.7 17.8Q13.9 16.1 14.8 14Q16.9 8.7 20.7 8.1ZM19.8 13.1Q18.1 11.5 17.1 13.3Q16.7 13.8 17.4 14.4Q18.2 15.2 20.7 16.4Q21.1 14 19.8 13.1Z';

export const ALLAH_VIEWBOX = '0 0 119.7 134.0';

export function LogoMark({ height = 24 }: { height?: number }) {
  return (
    <svg
      width={height * 0.8933}
      height={height}
      viewBox={ALLAH_VIEWBOX}
      aria-hidden="true"
      className="shrink-0"
    >
      <path d={ALLAH_PATH} fill="currentColor" />
    </svg>
  );
}

export function Logo({
  tagline = false,
  stacked = false,
}: {
  tagline?: boolean;
  stacked?: boolean;
}) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span className="text-accent">
        <LogoMark />
      </span>
      {stacked ? (
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-[16px] font-semibold tracking-tight">
            <span className="text-ink">Quran</span>
            <span className="text-accent">Bench</span>
          </span>
          {tagline ? (
            <span className="hidden text-[9.5px] uppercase tracking-[0.08em] text-ink3 sm:block">
              A Quran research workbench
            </span>
          ) : null}
        </span>
      ) : (
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-[17px] font-semibold tracking-tight">
            <span className="text-ink">Quran</span>
            <span className="text-accent">Bench</span>
          </span>
          {tagline ? (
            <span className="hidden text-[12px] text-ink3 lg:inline">
              a Quran research workbench
            </span>
          ) : null}
        </span>
      )}
    </span>
  );
}
