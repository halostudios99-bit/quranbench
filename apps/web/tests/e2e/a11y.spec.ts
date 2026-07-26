import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// WCAG 2.2 AA on each page type (design-system §6). We scan against the WCAG A
// and AA rule tags and require zero violations.
//
// A generous per-test timeout, because axe's own run is the slow part, not the
// app: a full surah page carries ~2,300 elements and ~600 addressable tokens, and
// scanning it measured 29.9s against the default 30s budget on an idle machine.
// That is one second from flaking, and it did flake — as four "failures" that
// were all timeouts, no violations — as soon as anything else was using the CPU.
// The assertion is unchanged; only the time axe is allowed to take.
// `/compare?q=mercy` is the extreme case: the reverse-gloss lookup is unbounded,
// so it renders 129 verses across four editions — about 11,500 elements, 1.3 MB
// of HTML (55 KB on the wire). Capping that result set would make this test fast
// and the page better; until then the scan needs room.
test.describe.configure({ timeout: 180_000 });
const PATHS = [
  '/',
  '/1',
  '/2',
  '/2/page/3',
  '/2/43',
  '/2/43-45',
  '/word/quran%3Atanzil-uthmani%3A2%3A43%3A4',
  '/word/quran%3Atanzil-uthmani%3A1%3A5%3A1',
  '/root/z-k-w',
  '/search?q=root:%D8%B2%20%D9%83%20%D9%88',
  '/compare',
  '/compare?v=2:255',
  '/compare?v=112:1-4',
  '/compare?q=mercy',
  '/data',
  '/method',
  '/identifiers',
  '/offline',
  '/about',
  '/colophon',
  '/report',
  '/report/thanks',
  '/gloss',
  '/gloss?q=reward',
  '/gloss/reward',
];

for (const path of PATHS) {
  test(`no accessibility violations: ${path}`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}
