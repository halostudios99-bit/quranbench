import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// The investigations list and the contributor terms are public, server-rendered
// pages. They must render complete content without JavaScript (CLAUDE.md rule 3)
// and pass WCAG 2.2 AA (design-system §6). The list degrades to an empty state
// when no investigations are published, so these hold with or without seed data.

test.describe('no JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('the investigations index renders server-side', async ({ page }) => {
    await page.goto('/investigations');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Investigations',
    );
  });

  test('the contributor terms render server-side', async ({ page }) => {
    await page.goto('/terms/contributor');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Contributor terms',
    );
    await expect(page.getByText('CC BY-SA 4.0').first()).toBeVisible();
  });
});

test.describe('accessibility', () => {
  for (const path of ['/investigations', '/terms/contributor']) {
    test(`no accessibility violations: ${path}`, async ({ page }) => {
      await page.goto(path);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }
});
