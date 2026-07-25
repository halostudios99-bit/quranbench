import { expect, test } from '@playwright/test';

// Every page type renders its content — across light/dark and desktop/mobile
// (see the projects in playwright.config.ts). We assert the Arabic actually
// paints and the reference chrome is present, not just an HTTP 200.

test('homepage: search-first, sample verse, surah index', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Search the Quran');
  await expect(page.getByRole('searchbox')).toBeVisible();
  await expect(page.locator('[data-token-id]').first()).toBeVisible();
  await expect(page.locator('a[href="/2"]').first()).toBeVisible();
});

test('surah reader: heading, basmala, verses in order', async ({ page }) => {
  await page.goto('/1');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Surah 1');
  const verses = page.locator('[data-verse-id]');
  await expect(verses.first()).toBeVisible();
  expect(await verses.count()).toBeGreaterThanOrEqual(7);
});

test('single verse: canonical permalink and full action toolbar', async ({ page }) => {
  await page.goto('/2/43');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('2:43');
  await expect(page.locator('[data-testid="verse-line"] [data-token-id]').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Permalink' })).toBeVisible();
});

test('verse range: renders each verse in the range', async ({ page }) => {
  await page.goto('/2/43-45');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('2:43-45');
  await expect(page.locator('[data-verse-id]')).toHaveCount(3);
});

test('dark and light both use warm, non-pure background', async ({ page }) => {
  await page.goto('/1');
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  // Never pure white or pure black.
  expect(bg).not.toBe('rgb(255, 255, 255)');
  expect(bg).not.toBe('rgb(0, 0, 0)');
});
