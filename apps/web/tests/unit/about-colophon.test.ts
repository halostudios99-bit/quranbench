import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import AboutPage from '@/app/about/page';
import ColophonPage from '@/app/colophon/page';
import {
  SITE_OWNER_NAME,
  SITE_OWNER_NAME_PENDING,
} from '@/lib/site';
import { artifactsRoot, currentVersion } from '@/server/artifacts';

describe('/about', () => {
  const html = renderToStaticMarkup(createElement(AboutPage));

  it('marks the owner name as a placeholder rather than inventing one', () => {
    expect(SITE_OWNER_NAME_PENDING).toBe(true);
    expect(html).toContain(SITE_OWNER_NAME);
    expect(html).toContain('data-owner-placeholder="true"');
    // The pending funding decision is also surfaced, not hidden.
    expect(html).toContain('data-funding-pending="true"');
  });

  it('states what it does not claim and never modifies scripture', () => {
    expect(html).toContain('does not claim');
    expect(html).toMatch(/immutable/i);
  });
});

// React escapes &, <, >, " and ' in rendered text; match the manifest name the
// same way so an apostrophe or ampersand in a source name still compares.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

describe('/colophon', () => {
  const html = renderToStaticMarkup(createElement(ColophonPage));

  it('lists every source in the corpus sources manifest', () => {
    const sources = JSON.parse(
      readFileSync(
        join(artifactsRoot(), `v${currentVersion()}`, 'sources.json'),
        'utf8',
      ),
    ) as { name: string; licence: string }[];
    expect(sources.length).toBeGreaterThan(0);
    for (const source of sources) {
      // Nothing the project stands on may be missing from the colophon.
      expect(html).toContain(escapeHtml(source.name));
    }
  });

  it('credits the typeface and the upstream authors', () => {
    expect(html).toContain('Amiri');
    expect(html).toContain('Tanzil');
    expect(html).toContain('Kais Dukes');
    expect(html).toContain('Lane');
  });
});
