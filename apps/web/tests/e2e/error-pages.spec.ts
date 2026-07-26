import { expect, test } from '@playwright/test';

// The 404 must be a real page in the site design: it offers search and useful
// navigation, and never exposes internals. (The 500 boundary is a client error
// component; it cannot be provoked reliably from a public URL, so its no-leak
// guarantee is enforced by construction in src/app/error.tsx and global-error.tsx.)

test('an unknown URL returns 404 with search and navigation, no stack trace', async ({
  page,
}) => {
  const response = await page.goto('/this-path-does-not-exist-42');
  expect(response?.status()).toBe(404);

  // Rendered in the site chrome, with the "404" marker and a real heading.
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    /could not be found/i,
  );

  // Offers search (a working GET form) and navigation onward.
  await expect(page.locator('input[name="q"]')).toBeVisible();
  await expect(page.getByRole('link', { name: /Search the corpus/i })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Home' })).toBeVisible();

  // Leaks nothing internal.
  const body = (await page.locator('body').innerText()).toLowerCase();
  expect(body).not.toContain('at /');
  expect(body).not.toContain('node_modules');
  expect(body).not.toMatch(/\bstack\b/);
  expect(body).not.toContain('econnrefused');
});

test('an unknown corpus token id 404s cleanly rather than erroring', async ({
  page,
}) => {
  const response = await page.goto('/word/quran%3Atanzil-uthmani%3A999%3A999%3A999');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
