import { expect, test } from '@playwright/test';

// /random redirects to a word page, and is deterministic when seeded (workplan
// item 15).

test('random resolves to a valid word page', async ({ page }) => {
  await page.goto('/random');
  await expect(page).toHaveURL(/\/word\//);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('[data-token-id]').first()).toBeVisible();
});

test('a seeded random run is deterministic', async ({ page }) => {
  await page.goto('/random?seed=fixed-seed-123');
  const first = page.url();
  expect(first).toMatch(/\/word\//);
  await page.goto('/random?seed=fixed-seed-123');
  expect(page.url()).toBe(first);
});

test('different seeds generally land on different words', async ({ page }) => {
  await page.goto('/random?seed=alpha');
  const a = page.url();
  await page.goto('/random?seed=omega');
  expect(page.url()).not.toBe(a);
});
