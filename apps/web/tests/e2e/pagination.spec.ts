import { expect, test } from '@playwright/test';

// Long-surah pagination: real routing, canonical pages, every verse still
// addressable. Al-Baqara (surah 2, 286 verses) paginates into 8 pages of 40.

test('surah 2 page 1 shows a page indicator and next-page link', async ({
  page,
}) => {
  await page.goto('/2');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Surah 2',
  );
  await expect(page.getByTestId('page-indicator')).toContainText('Page 1 of 8');
  await expect(page.locator('a[rel="next"]').first()).toBeVisible();
});

test('a middle page renders its own verses', async ({ page }) => {
  await page.goto('/2/page/3');
  await expect(page.getByTestId('page-indicator')).toContainText('Page 3 of 8');
  await expect(page.locator('[data-token-id]').first()).toBeVisible();
  // Canonical points at itself; prev/next are present.
  await expect(page.locator('link[rel="prev"]')).toHaveCount(1);
  await expect(page.locator('link[rel="next"]')).toHaveCount(1);
});

test('/2/page/1 redirects to the canonical bare surah page', async ({
  page,
}) => {
  await page.goto('/2/page/1');
  await expect(page).toHaveURL(/\/2$/);
});

test('every verse stays addressable regardless of its page', async ({
  page,
}) => {
  // 2:43 falls on page 2; 2:255 falls on page 7 — both resolve directly.
  for (const ref of ['43', '255']) {
    const res = await page.goto(`/2/${ref}`);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      `2:${ref}`,
    );
  }
});

test('the continuous view is available and marked noindex', async ({
  page,
}) => {
  await page.goto('/2/all');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Surah 2',
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    /noindex/,
  );
  // It holds the whole surah in one document.
  expect(await page.locator('[data-verse-id]').count()).toBeGreaterThan(200);
});
