import { expect, test } from '@playwright/test';

// Keyboard navigation end-to-end (design-system §6; workplan item 14). Arrow keys
// move between tokens, Enter opens the word page, `/` focuses search, and the
// focused word is announced politely.

function activeTokenId(page: import('@playwright/test').Page) {
  return page.evaluate(
    () => document.activeElement?.getAttribute('data-token-id') ?? null,
  );
}

test('arrow keys move focus between tokens', async ({ page }) => {
  await page.goto('/2/43');
  const tokens = page.locator('a[data-token-id]');
  const firstId = await tokens.first().getAttribute('data-token-id');
  const secondId = await tokens.nth(1).getAttribute('data-token-id');

  await tokens.first().focus();
  expect(await activeTokenId(page)).toBe(firstId);

  // Arabic reads right-to-left, so ArrowLeft moves forward to the next token.
  await page.keyboard.press('ArrowLeft');
  expect(await activeTokenId(page)).toBe(secondId);

  // ArrowRight moves back.
  await page.keyboard.press('ArrowRight');
  expect(await activeTokenId(page)).toBe(firstId);
});

test('the focused word is announced to screen readers', async ({ page }) => {
  await page.goto('/2/43');
  const tokens = page.locator('a[data-token-id]');
  await tokens.first().focus();
  await page.keyboard.press('ArrowLeft');
  const announcer = page.locator('[data-testid="token-announcer"]');
  await expect(announcer).not.toBeEmpty();
});

test('Enter opens the focused word page', async ({ page }) => {
  await page.goto('/2/43');
  await page.locator('a[data-token-id]').first().focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/word\//);
});

test('“/” focuses the search box', async ({ page }) => {
  await page.goto('/search');
  await page.keyboard.press('/');
  const focusedId = await page.evaluate(() => document.activeElement?.id ?? null);
  expect(focusedId).toBe('q');
});

test('a focused token shows a visible focus ring', async ({ page }) => {
  await page.goto('/2/43');
  const first = page.locator('a[data-token-id]').first();
  await first.focus();
  const outline = await first.evaluate(
    (el) => getComputedStyle(el).outlineStyle,
  );
  expect(outline).not.toBe('none');
});
