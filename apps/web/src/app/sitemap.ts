import type { MetadataRoute } from 'next';

import { verseHref, surahHref } from '@/lib/addressing';
import { listSurahs, getSurahVerses } from '@/server/corpus';
import { absoluteUrl } from '@/lib/site';

// Every addressable unit rendered this prompt appears in the sitemap: homepage,
// search, each surah, each verse. Well under the 50,000-URL segment limit.
export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [
    { url: absoluteUrl('/'), changeFrequency: 'monthly', priority: 1 },
    { url: absoluteUrl('/search'), changeFrequency: 'monthly', priority: 0.5 },
  ];
  for (const surah of listSurahs()) {
    entries.push({ url: absoluteUrl(surahHref(surah.number)), changeFrequency: 'yearly', priority: 0.8 });
    for (const view of getSurahVerses(surah.number)) {
      entries.push({
        url: absoluteUrl(verseHref(surah.number, view.ordinal)),
        changeFrequency: 'yearly',
        priority: 0.6,
      });
    }
  }
  return entries;
}
