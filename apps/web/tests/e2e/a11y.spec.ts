import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// WCAG 2.2 AA on each page type (design-system §6). We scan against the WCAG A
// and AA rule tags and require zero violations.
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
