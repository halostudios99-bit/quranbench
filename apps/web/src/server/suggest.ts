import 'server-only';

import { normaliseArabic } from '@quranbench/search';

import { getIndex, listGlossIndex, listSurahs } from './corpus';

/**
 * Search autosuggest.
 *
 * The dropdown is a convenience layered over the plain GET form — search must
 * keep working with JavaScript off (rule 3), so nothing here is load-bearing.
 * Suggestions come from the same in-memory index the search engine uses; no
 * database, no network, and the corpus is immutable, so everything can be
 * precomputed once and binary-searched per keystroke.
 *
 * What is suggested, and why these sources:
 *   - surah names (Arabic, transliterated, English) — the most common thing a
 *     reader types is a surah they half-remember the name of
 *   - verse references (2:255) — direct navigation, no search needed
 *   - roots — the primary research object of the site
 *   - Arabic word forms — ranked by how often they occur, because a frequent
 *     form is the more likely target of a half-typed prefix
 *   - English glosses — the reverse-lookup path for non-Arabic readers
 *
 * Every suggestion navigates to a server-rendered page (`href`) or fills the
 * query box (`q`), never both. Types are distinguished so the client can label
 * them without guessing.
 */

export interface Suggestion {
  /** What kind of thing this is — the client shows it as a label. */
  type: 'surah' | 'verse' | 'root' | 'word' | 'gloss';
  /** Text shown in the dropdown row. */
  label: string;
  /** Secondary text (occurrence count, surah number, …). */
  detail: string;
  /** Navigate here on selection… */
  href?: string;
  /** …or fill the search box with this and submit. */
  q?: string;
}

const LIMIT = 8;

interface Tables {
  /** [normalised form, occurrence count], sorted by form for prefix search. */
  forms: [string, number][];
  /** [spaceless root, spaced root, slug, count], sorted by spaceless root. */
  roots: [string, string, string, number][];
  surahs: {
    number: number;
    ar: string;
    translit: string;
    /** Folded transliteration, with and without the article ("Al-"). */
    tr: string;
    trBare: string;
    en: string;
    enFolded: string;
  }[];
}

/**
 * Fold a name for matching: lowercase, drop punctuation, collapse doubled
 * letters. Tanzil's transliterations double long vowels ("Al-Faatiha",
 * "An-Naas") which nobody types; folding both sides lets "fatiha" match.
 */
function fold(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .replace(/(.)\1+/g, '$1');
}

/** The folded name minus a leading Arabic article (al/an/as/ar/at/az/ad/ash). */
function bare(folded: string): string {
  return folded.replace(/^a(l|n|s|r|t|z|d|sh)/, '');
}

let tables: Tables | null = null;

function build(): Tables {
  if (tables) return tables;
  const index = getIndex();

  const forms: [string, number][] = [];
  for (const [form, handles] of index.normalised) {
    forms.push([form, handles.length]);
  }
  forms.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

  // rootBySlug maps slug → spaced Arabic; suggestions need the inverse too.
  const slugOf = new Map<string, string>();
  for (const [slug, spaced] of index.rootBySlug) slugOf.set(spaced, slug);

  const roots: [string, string, string, number][] = [];
  for (const [spaced, handles] of index.root) {
    const slug = slugOf.get(spaced);
    if (!slug) continue;
    roots.push([spaced.replace(/ /g, ''), spaced, slug, handles.length]);
  }
  roots.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

  const surahs = listSurahs().map((s) => {
    const tr = fold(s.name_translit);
    return {
      number: s.number,
      ar: s.name_ar,
      translit: s.name_translit,
      tr,
      trBare: bare(tr),
      en: s.name_en,
      enFolded: fold(s.name_en),
    };
  });

  tables = { forms, roots, surahs };
  return tables;
}

/** First index in `sorted` whose key is >= `prefix` (binary search). */
function lowerBound<T>(sorted: T[], key: (t: T) => string, prefix: string): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (key(sorted[mid]!) < prefix) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function prefixMatches<T>(
  sorted: T[],
  key: (t: T) => string,
  prefix: string,
  cap: number,
): T[] {
  const out: T[] = [];
  for (let i = lowerBound(sorted, key, prefix); i < sorted.length; i++) {
    const k = key(sorted[i]!);
    if (!k.startsWith(prefix)) break;
    out.push(sorted[i]!);
    if (out.length >= cap * 4) break; // gather extra so we can rank by count
  }
  return out;
}

const ARABIC = /[؀-ۿ]/;
const VERSE_REF = /^(\d{1,3})\s*[:.]\s*(\d{1,3})$/;
const SURAH_ONLY = /^(\d{1,3})$/;

export function suggest(raw: string): Suggestion[] {
  const query = raw.trim();
  if (!query || query.length > 60) return [];
  const t = build();
  const out: Suggestion[] = [];

  // Verse reference (2:255) and bare surah number (2) — direct navigation.
  const ref = VERSE_REF.exec(query);
  if (ref) {
    const surah = t.surahs.find((s) => s.number === Number(ref[1]));
    if (surah) {
      out.push({
        type: 'verse',
        label: `${surah.translit} ${ref[1]}:${ref[2]}`,
        detail: 'go to verse',
        href: `/${ref[1]}#${ref[2]}`,
      });
    }
  } else {
    const num = SURAH_ONLY.exec(query);
    if (num) {
      const surah = t.surahs.find((s) => s.number === Number(num[1]));
      if (surah) {
        out.push({
          type: 'surah',
          label: `${surah.number}. ${surah.translit}`,
          detail: surah.en,
          href: `/${surah.number}`,
        });
      }
    }
  }

  if (ARABIC.test(query)) {
    const norm = normaliseArabic(query);

    // Surah names in Arabic.
    for (const s of t.surahs) {
      if (out.length >= LIMIT) break;
      if (normaliseArabic(s.ar).startsWith(norm)) {
        out.push({
          type: 'surah',
          label: `${s.number}. ${s.ar}`,
          detail: s.translit,
          href: `/${s.number}`,
        });
      }
    }

    // Roots — compare without the spaces so typing زكو finds ز ك و.
    const spaceless = norm.replace(/ /g, '');
    const roots = prefixMatches(t.roots, (r) => r[0], spaceless, LIMIT)
      .sort((a, b) => b[3] - a[3])
      .slice(0, 3);
    for (const [, spaced, slug, count] of roots) {
      out.push({
        type: 'root',
        label: `root: ${spaced}`,
        detail: `${count.toLocaleString()} occurrences`,
        href: `/root/${slug}`,
      });
    }

    // Word forms, most frequent first.
    const forms = prefixMatches(t.forms, (f) => f[0], norm, LIMIT)
      .sort((a, b) => b[1] - a[1])
      .slice(0, Math.max(0, LIMIT - out.length));
    for (const [form, count] of forms) {
      out.push({
        type: 'word',
        label: form,
        detail: `${count.toLocaleString()} occurrence${count === 1 ? '' : 's'}`,
        q: form,
      });
    }

    return out.slice(0, LIMIT);
  }

  // Latin input: surah names first — prefix beats substring beats nothing.
  const lower = query.toLowerCase();
  const folded = fold(query);
  const named = t.surahs
    .map((s) => {
      const score =
        folded &&
        (s.tr.startsWith(folded) ||
          s.trBare.startsWith(folded) ||
          s.enFolded.startsWith(folded))
          ? 2
          : folded && (s.tr.includes(folded) || s.enFolded.includes(folded))
            ? 1
            : 0;
      return { s, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.s.number - b.s.number)
    .slice(0, 3);
  for (const { s } of named) {
    out.push({
      type: 'surah',
      label: `${s.number}. ${s.translit}`,
      detail: s.en,
      href: `/${s.number}`,
    });
  }

  // English glosses via the reverse-lookup index.
  if (lower.length >= 2) {
    const glosses = listGlossIndex(lower, 24).items;
    const ranked = [
      ...glosses.filter((g) => g.key.startsWith(lower)),
      ...glosses.filter((g) => !g.key.startsWith(lower)),
    ].slice(0, Math.max(0, LIMIT - out.length));
    for (const g of ranked) {
      out.push({
        type: 'gloss',
        label: g.gloss,
        detail: `${g.rootCount} Arabic root${g.rootCount === 1 ? '' : 's'}`,
        href: `/gloss/${g.slug}`,
      });
    }
  }

  return out.slice(0, LIMIT);
}
