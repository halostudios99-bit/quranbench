import type { MetadataRoute } from 'next';

import {
  glossHref,
  rootHref,
  surahHref,
  surahPageHref,
  verseHref,
  wordHref,
} from '@/lib/addressing';
import { surahPageCount } from '@/lib/pagination';
import { absoluteUrl } from '@/lib/site';
import {
  getCorpus,
  getSurahVerses,
  listReverseGlosses,
  listSurahs,
} from '@/server/corpus';

// Every addressable unit appears in a sitemap, segmented under the 50,000-URL
// limit (design-system §5). Segment 0 carries the reader surfaces (surahs, their
// pages, verses) and every root; each further segment carries a slice of the
// ~77,430 word pages. Next serves these at /sitemap/[id].xml.

const WORDS_PER_SITEMAP = 45000;

function wordSegmentCount(): number {
  return Math.max(1, Math.ceil(getCorpus().tokens.length / WORDS_PER_SITEMAP));
}

export function generateSitemaps(): { id: number }[] {
  const ids = [{ id: 0 }];
  for (let i = 0; i < wordSegmentCount(); i++) ids.push({ id: i + 1 });
  return ids;
}

export default function sitemap({ id }: { id: number }): MetadataRoute.Sitemap {
  // Next passes the segment id as a string route param; coerce before comparing.
  const segment = Number(id);
  if (segment === 0) return coreAndRoots();
  const tokens = getCorpus().tokens;
  const start = (segment - 1) * WORDS_PER_SITEMAP;
  return tokens.slice(start, start + WORDS_PER_SITEMAP).map((t) => ({
    url: absoluteUrl(wordHref(t.id)),
    changeFrequency: 'yearly' as const,
    priority: 0.5,
  }));
}

function coreAndRoots(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [
    { url: absoluteUrl('/'), changeFrequency: 'monthly', priority: 1 },
    { url: absoluteUrl('/search'), changeFrequency: 'monthly', priority: 0.5 },
    { url: absoluteUrl('/about'), changeFrequency: 'monthly', priority: 0.6 },
    { url: absoluteUrl('/method'), changeFrequency: 'monthly', priority: 0.6 },
    { url: absoluteUrl('/colophon'), changeFrequency: 'monthly', priority: 0.5 },
    { url: absoluteUrl('/identifiers'), changeFrequency: 'yearly', priority: 0.5 },
    { url: absoluteUrl('/data'), changeFrequency: 'monthly', priority: 0.5 },
  ];
  // Reverse-gloss pages worth advertising: those where one English gloss spans two
  // or more distinct Arabic roots — the "different words, same rendering" cases.
  for (const gloss of listReverseGlosses()) {
    entries.push({
      url: absoluteUrl(glossHref(gloss.key)),
      changeFrequency: 'yearly',
      priority: 0.4,
    });
  }
  for (const surah of listSurahs()) {
    entries.push({
      url: absoluteUrl(surahHref(surah.number)),
      changeFrequency: 'yearly',
      priority: 0.8,
    });
    const pages = surahPageCount(surah.verse_count);
    for (let p = 2; p <= pages; p++) {
      entries.push({
        url: absoluteUrl(surahPageHref(surah.number, p)),
        changeFrequency: 'yearly',
        priority: 0.6,
      });
    }
    for (const view of getSurahVerses(surah.number)) {
      entries.push({
        url: absoluteUrl(verseHref(surah.number, view.ordinal)),
        changeFrequency: 'yearly',
        priority: 0.6,
      });
    }
  }
  for (const root of getCorpus().roots) {
    entries.push({
      url: absoluteUrl(rootHref(root.root_slug)),
      changeFrequency: 'yearly',
      priority: 0.7,
    });
  }
  return entries;
}
