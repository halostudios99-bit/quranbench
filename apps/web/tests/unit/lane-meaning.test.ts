import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { RootPage } from '@/components/RootPage';

// The Lane "Meaning" section on a root page: it must render the entry where Lane
// has one, and an *explicit* "no entry" message where it does not — never a blank
// that reads as "no meaning". Full entry text ships in the HTML (crawlable).

function occ(id = 'quran:tanzil-uthmani:2:43:4') {
  return {
    tokenId: id,
    segmentId: 'quran:tanzil-uthmani:2:43',
    surah: 2,
    ordinal: 43,
    position: 4,
    text: 'ٱلزَّكَوٰةَ',
    ref: '2:43',
    href: '/2/43',
    wordHref: `/word/${encodeURIComponent(id)}`,
  };
}

function view(lane: unknown) {
  const o = occ();
  return {
    root: {
      root: 'ز ك و',
      root_slug: 'z-k-w',
      lemmas: [],
      occurrences: 59,
      token_ids: [],
    },
    transliteration: 'z · k · w',
    occurrences: 59,
    distinctForms: 1,
    forms: [{ form: 'ٱلزَّكَوٰةَ', count: 1, representative: o }],
    surahDistribution: [{ surah: 2, name: 'Al-Baqarah', count: 1 }],
    maxSurahCount: 1,
    first: o,
    last: o,
    lemmas: [],
    verseCount: 1,
    lane,
  };
}

const occurrences = { page: 1, pageCount: 1, total: 0, items: [] };

function render(lane: unknown) {
  return renderToStaticMarkup(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createElement(RootPage as any, {
      view: view(lane),
      occurrences,
      coOccurrence: { verseCount: 0, items: [] },
      edition: 'Tanzil Uthmani',
      corpusVersion: '0.8.0',
      citing: [],
    }),
  );
}

describe('Lane Meaning section', () => {
  it('renders the entry, its attribution and a full-entry expander when Lane has one', () => {
    const html = render({
      root_slug: 'z-k-w',
      root: 'ز ك و',
      headword_ar: 'زكو',
      headword_bw: 'zkw',
      match: 'direct',
      source_id: 'lane-lexicon',
      licence: 'CC-BY-SA-3.0',
      text: 'It increased, or augmented.\n\nHe purified himself.\n\nA third passage.',
    });
    expect(html).toContain('Meaning');
    expect(html).toContain('Lane');
    expect(html).toContain('It increased, or augmented.');
    // Full text present in HTML for crawlers, behind a native <details> expander.
    expect(html).toContain('<details');
    expect(html).toContain('A third passage.');
    expect(html).toContain('CC BY-SA 3.0');
  });

  it('shows an explicit no-entry message where Lane has none', () => {
    const html = render(null);
    expect(html).toMatch(/No entry in Lane/i);
    // The message says absence ≠ no meaning, not a bare blank.
    expect(html).toMatch(/not that it has no\s+meaning/i);
  });
});
