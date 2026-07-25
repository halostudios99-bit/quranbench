import 'server-only';

import {
  parseAyahParam,
  parseSurahParam,
  rootHref,
  surahHref,
  verseHref,
  wordHref,
} from '@/lib/addressing';
import { absoluteUrl } from '@/lib/site';
import {
  describeToken,
  getCorpus,
  getRootBySlug,
  getSurah,
  getVerse,
  getVerseRange,
} from '@/server/corpus';

// JSON-LD served at the same URL as each corpus page under
// `Accept: application/ld+json` (docs/extensibility.md §5). Machine-readable
// structure alongside every human page; the corpus version is always present so
// an extracted statement remains attributable to a specific dataset release.

function withContext(data: Record<string, unknown>): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    ...data,
    corpusVersion: getCorpus().version,
  };
}

function wordJsonLd(tokenId: string): Record<string, unknown> | null {
  const view = describeToken(tokenId);
  if (!view) return null;
  const { token, root } = view;
  return withContext({
    '@type': 'DefinedTerm',
    name: token.text_uthmani,
    alternateName: token.text_no_tashkeel,
    identifier: token.id,
    url: absoluteUrl(wordHref(token.id)),
    inLanguage: 'ar',
    isPartOf: { '@type': 'WebPage', url: absoluteUrl(view.verseHref) },
    ...(root
      ? {
          inDefinedTermSet: {
            '@type': 'DefinedTermSet',
            name: `Root ${root.root}`,
            url: absoluteUrl(rootHref(root.slug)),
          },
        }
      : {}),
  });
}

function rootJsonLd(slug: string): Record<string, unknown> | null {
  const root = getRootBySlug(slug);
  if (!root) return null;
  return withContext({
    '@type': 'DefinedTermSet',
    name: `Root ${root.root}`,
    alternateName: root.root_slug,
    identifier: root.root_slug,
    url: absoluteUrl(rootHref(root.root_slug)),
    inLanguage: 'ar',
    description: `Triliteral root ${root.root} — ${root.occurrences} occurrences across the corpus.`,
  });
}

function verseJsonLd(
  surah: number,
  from: number,
  to: number,
): Record<string, unknown> | null {
  const surahRec = getSurah(surah);
  if (!surahRec) return null;
  const views =
    from === to ? [getVerse(surah, from)] : getVerseRange(surah, from, to);
  const present = views.filter((v) => v !== undefined);
  if (present.length === 0) return null;
  const ref = from === to ? `${surah}:${from}` : `${surah}:${from}-${to}`;
  return withContext({
    '@type': 'CreativeWork',
    name: `Quran ${ref}`,
    identifier: `quran:${ref}`,
    inLanguage: 'ar',
    isPartOf: {
      '@type': 'CreativeWork',
      name: surahRec.name_en,
      url: absoluteUrl(surahHref(surah)),
    },
    url: absoluteUrl(
      from === to ? verseHref(surah, from) : `/${surah}/${from}-${to}`,
    ),
    text: present.map((v) => v!.segment.text_uthmani).join(' '),
  });
}

function surahJsonLd(n: number): Record<string, unknown> | null {
  const surah = getSurah(n);
  if (!surah) return null;
  return withContext({
    '@type': 'CreativeWork',
    name: `Surah ${surah.name_en}`,
    alternateName: surah.name_ar,
    identifier: `quran:${n}`,
    position: n,
    inLanguage: 'ar',
    url: absoluteUrl(surahHref(n)),
    hasPart: {
      '@type': 'CreativeWorkSeries',
      numberOfItems: surah.verse_count,
    },
  });
}

/** Dispatch a corpus page pathname to its JSON-LD document, or null. */
export function jsonLdForPath(
  pathname: string,
): Record<string, unknown> | null {
  const clean = pathname.replace(/\/+$/, '') || '/';
  const parts = clean
    .split('/')
    .filter(Boolean)
    .map((p) => decodeURIComponent(p));

  if (parts[0] === 'word' && parts[1])
    return wordJsonLd(parts.slice(1).join('/'));
  if (parts[0] === 'root' && parts[1]) return rootJsonLd(parts[1]);

  // /{surah} and /{surah}/{ayah}
  if (parts.length >= 1) {
    const surah = parseSurahParam(parts[0]!);
    if (surah !== null) {
      if (parts.length === 1) return surahJsonLd(surah);
      const range = parseAyahParam(parts[1]!);
      if (range && parts.length === 2)
        return verseJsonLd(surah, range.from, range.to);
    }
  }
  return null;
}
