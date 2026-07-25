import { expect, test } from '@playwright/test';

// The delegated action controller + registry + copy builders, end to end. Arabic
// only carries no attribution; Arabic + reference appends the reference line.
test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

test('copy "Arabic (Uthmani)" writes the verse with no attribution', async ({ page }) => {
  await page.goto('/2/43');
  await page.getByRole('button', { name: 'Copy' }).click();
  await page.getByRole('menuitem', { name: 'Arabic (Uthmani)' }).click();
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text.length).toBeGreaterThan(0);
  expect(text).not.toContain('Al-Baqarah 2:43');
  expect(text).not.toContain('corpus v');
});

test('copy "Arabic + reference" appends the reference and source', async ({ page }) => {
  await page.goto('/2/43');
  await page.getByRole('button', { name: 'Copy' }).click();
  await page.getByRole('menuitem', { name: 'Arabic + reference' }).click();
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toContain('2:43');
  expect(text).toContain('corpus v0.7.0');
  expect(text).toContain('quranbench.com/2/43');
});

test('permalink copies the canonical URL', async ({ page }) => {
  await page.goto('/2/43');
  await page.getByRole('button', { name: 'Permalink' }).click();
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toContain('/2/43');
});
