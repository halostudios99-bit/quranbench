import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// WCAG 2.2 AA on each page type (design-system §6). We scan against the WCAG A
// and AA rule tags and require zero violations.
const PATHS = ['/', '/1', '/2/43', '/2/43-45', '/search?q=root:%D8%B2%20%D9%83%20%D9%88'];

for (const path of PATHS) {
  test(`no accessibility violations: ${path}`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}
