import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Token } from '@/components/Token';

const SRC = fileURLToPath(new URL('../../src', import.meta.url));

function tokenRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'quran:tanzil-uthmani:2:2:2',
    segment_id: 'quran:tanzil-uthmani:2:2',
    surah: 2,
    slot: '2',
    position: 2,
    text_uthmani: 'ٱلْكِتَٰبُ',
    text_simple: 'الكتاب',
    text_no_tashkeel: 'الكتاب',
    text_normalised: 'الكتاب',
    char_start: 0,
    char_end: 0,
    following_marks: [],
    is_basmala: false,
    morphology: {
      root: 'ك ت ب',
      root_slug: 'k-t-b',
      lemma: 'كِتَاب',
      pos: 'N',
      features: {},
      segments: [],
      gloss: 'the Book',
      gloss_source: 'qac-word-gloss',
      transliteration: 'al-kitābu',
      transliteration_source: 'qac-word-transliteration',
      root_occurrences: 319,
      morphology_source: 'leeds-qac-morphology',
      alignment: 'exact',
      ...(overrides['morphology'] as object | undefined),
    },
    ...overrides,
  };
}

describe('Token carries the tooltip payload in data-* attributes', () => {
  it('emits gloss, transliteration and root so the tooltip needs no fetch', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const html = renderToStaticMarkup(
      createElement(Token as any, { token: tokenRecord() }),
    );
    expect(html).toContain('data-gloss="the Book"');
    expect(html).toContain('data-translit="al-kitābu"');
    expect(html).toContain('data-translit-source="qac-word-transliteration"');
    expect(html).toContain('data-root="ك ت ب"');
    expect(html).toContain('data-root-slug="k-t-b"');
    expect(html).toContain('data-root-count="319"');
  });

  it('omits attributes that are genuinely absent (null, not empty)', () => {
    const token = tokenRecord({
      morphology: {
        root: null,
        root_slug: null,
        root_occurrences: null,
        gloss: null,
        gloss_source: null,
        transliteration: 'wa-',
        transliteration_source: 'qac-word-transliteration',
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const html = renderToStaticMarkup(createElement(Token as any, { token }));
    expect(html).not.toContain('data-gloss');
    expect(html).not.toContain('data-root=');
    expect(html).not.toContain('data-root-count');
    expect(html).toContain('data-translit="wa-"');
  });
});

describe('the tooltip is one global controller, mounted once, and never fetches', () => {
  it('is mounted in the root layout', () => {
    const layout = readFileSync(`${SRC}/app/layout.tsx`, 'utf8');
    expect(layout).toContain('<TokenTooltip />');
  });

  it('reads its data from the DOM, not the network (no fetch on hover)', () => {
    const controller = readFileSync(
      `${SRC}/components/TokenTooltip.tsx`,
      'utf8',
    );
    expect(controller).not.toMatch(/\bfetch\s*\(/);
    expect(controller).not.toMatch(/XMLHttpRequest/);
    // 200ms show delay and a 120ms opacity-only fade are the design-system values.
    expect(controller).toContain('SHOW_DELAY = 200');
  });
});
