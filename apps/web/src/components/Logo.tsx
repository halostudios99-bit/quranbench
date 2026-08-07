// The site logo: الله written in the site's own Amiri Quran typeface,
// converted to a vector outline (HarfBuzz shaping of the Allah ligature,
// exported once at build-design time — see the commit message). An outline
// rather than live text so it renders identically everywhere, needs no font
// load, and can never fall back to an unshapen letter sequence. Inline SVG
// with currentColor so it follows the theme; works with JavaScript off.

const ALLAH_PATH =
  'M43.3 84.6Q45.3 84.6 46.1 88.4Q47 92.1 46.1 95.8Q45.3 99.6 43.4 99.7Q31.1 101 28.2 86.1Q28 85.6 28 85.2Q23.3 92.2 20.8 92.7Q8.2 95 1.6 90.4Q-0.8 88.6 0.4 85.1Q3 76.7 10.2 70.8Q17.5 64.8 25.6 62.9L25.3 55.9Q25.3 54.7 27.7 49.6Q29 47.1 29.8 45.6Q30.5 44.1 30.6 43.8Q32.2 41.2 32.5 45.7Q32.5 46.6 32.6 49.1Q32.6 51.7 32.8 56.2Q32.9 60.6 33.1 64.7Q33.3 68.8 33.8 72.8Q34.6 80.7 38.4 83.3Q40.1 84.6 43.3 84.6ZM25.9 69.8Q24.4 70.1 22.4 70.9Q20.4 71.7 17.8 73Q12.7 75.6 11.2 78.3Q13.5 80 21.3 79.7Q25.2 79.5 26.7 77.7Q26.6 77 26.4 75Q26.2 73 25.9 69.8ZM77 83.3Q79.6 83.8 80.5 87.8Q81.3 91.8 80.5 95.7Q79.6 99.7 78.3 99.7Q72.4 99.9 68.1 96.1Q64.2 92.7 60.2 85.1Q58.1 90.1 56.2 93.2Q54.3 96.3 52.6 97.3Q48.9 99.4 43.6 99.6Q40.2 99.9 38.5 95.8Q36.8 92 37.8 88.4Q39 84.6 43.4 84.6Q53.8 84.6 56.9 77.4Q56.9 77.4 56.7 75.9Q56.5 74.3 55.9 71.1L52.7 54.9Q51.7 49.9 51.2 46.5Q50.6 43.1 50.3 41.2Q49.9 37.5 50.9 36.1L55 29.5Q56.5 27.4 57.3 31.2Q57.6 32 58.1 34.7Q58.5 37.4 59.1 41.7Q63.7 71 67.1 76.7Q70.6 82.5 77 83.3ZM79.2 31.3 86.5 65.1Q87.2 68.8 87.7 71.4Q88.2 74 88.4 75.6Q88.5 77 88.5 78.7Q88.5 80.5 88.2 82.5Q86.5 99.7 78.2 99.7Q73.7 99.7 70.9 93.7Q68.1 87.6 70.4 85.1Q72.9 82.3 76 83.2Q79.5 84.1 81.9 82.9Q81.8 81.2 80.8 76.6Q79.9 72 78.2 64.7Q74.7 50.3 73 40.2Q72.4 36.4 76.9 29.9Q78.3 27.6 79.2 31.3ZM110.1 3.6Q113.1 -3.4 114 3.3L117.3 38.5Q122.7 86.1 116 98.9Q115 100.6 114.4 99.7Q113.8 99 113.8 97.3Q114.1 85.2 112.1 70.1Q112.1 69.5 109.1 42.8L105.9 16.8Q105.6 13.9 106.5 11.9Z';

export const ALLAH_VIEWBOX = '0 0 119.7 100';

export function LogoMark({ height = 20 }: { height?: number }) {
  return (
    <svg
      width={height * 1.197}
      height={height}
      viewBox={ALLAH_VIEWBOX}
      aria-hidden="true"
      className="shrink-0"
    >
      <path d={ALLAH_PATH} fill="currentColor" />
    </svg>
  );
}

export function Logo({ tagline = false }: { tagline?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span className="text-accent">
        <LogoMark />
      </span>
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
    </span>
  );
}
