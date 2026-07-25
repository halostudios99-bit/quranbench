import { expect, test } from '@playwright/test';

// Word pages are the deep-linkable research objects. We assert the token, its
// morphology, its root link and the graceful rootless case.

const ZAKAH = '/word/quran%3Atanzil-uthmani%3A2%3A43%3A4';
const ROOTLESS = '/word/quran%3Atanzil-uthmani%3A1%3A5%3A1'; // إِيَّاكَ — a pronoun, no root

test('word page: token, root ز ك و, and a link to /root/z-k-w', async ({
  page,
}) => {
  await page.goto(ZAKAH);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  // The morphology block names the root and links to its canonical slug page.
  await expect(page.getByText('ز ك و').first()).toBeVisible();
  const rootLink = page.locator('a[href="/root/z-k-w"]').first();
  await expect(rootLink).toBeVisible();
  // Position links back to its verse; the containing verse is rendered.
  await expect(page.locator('a[href="/2/43"]').first()).toBeVisible();
  await expect(
    page.locator('[data-testid="verse-line"] [data-token-id]').first(),
  ).toBeVisible();
  // The subject token is highlighted inside its containing verse.
  await expect(
    page.locator('[data-token-id][data-highlight="true"]').first(),
  ).toBeVisible();
});

test('word page: the same-form occurrence count is shown', async ({ page }) => {
  await page.goto(ZAKAH);
  await expect(page.getByRole('heading', { name: /Same form/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Root ز ك و/ })).toBeVisible();
});

test('rootless token renders gracefully', async ({ page }) => {
  const res = await page.goto(ROOTLESS);
  expect(res?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  // The morphology block states there is no root rather than erroring.
  await expect(page.getByText(/no triliteral root/)).toBeVisible();
  // And there is no root-page link on a rootless word.
  await expect(page.locator('a[href^="/root/"]')).toHaveCount(0);
});

test('word page has a specific, non-templated title', async ({ page }) => {
  await page.goto(ZAKAH);
  await expect(page).toHaveTitle(/2:43:4/);
});

test('word page shows how translators rendered it, labelling the verse-level limit', async ({
  page,
}) => {
  await page.goto(ZAKAH);
  const section = page.locator('section', {
    has: page.getByRole('heading', { name: /How translators rendered it/ }),
  });
  await expect(section).toBeVisible();
  // Honest about the limitation: verse-level, not word-level.
  await expect(section.getByText(/verse-level/)).toBeVisible();
  await expect(section.getByText(/not this word alone/)).toBeVisible();
  // Each edition carries the translation ProvenanceTag.
  await expect(section.locator('[data-provenance="translation"]').first()).toBeVisible();
});
