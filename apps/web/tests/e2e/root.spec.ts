import { expect, test } from '@playwright/test';

// Root pages aggregate every occurrence and derived form of a root.
const ARABIC_ZKW = '/root/%D8%B2%20%D9%83%20%D9%88'; // "ز ك و"

test('root page: 59 occurrences and a derived-form list', async ({ page }) => {
  await page.goto('/root/z-k-w');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('ز ك و');
  // The occurrence total is shown (z-k-w occurs 59 times).
  await expect(page.getByText('59', { exact: true }).first()).toBeVisible();
  // Derived forms are listed, each linking to a representative word page.
  await expect(
    page.getByRole('heading', { name: /Derived forms/ }),
  ).toBeVisible();
  await expect(page.locator('a[href^="/word/"]').first()).toBeVisible();
  // The full occurrence list renders verses with the root highlighted.
  await expect(
    page.locator('[data-token-id][data-highlight="true"]').first(),
  ).toBeVisible();
});

test('root page: distribution and lemma sections render', async ({ page }) => {
  await page.goto('/root/z-k-w');
  await expect(
    page.getByRole('heading', { name: /Distribution across surahs/ }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Lemmas' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: /Occurrences/ }),
  ).toBeVisible();
});

test("root with a Lane's Lexicon entry renders the Meaning section", async ({
  page,
}) => {
  await page.goto('/root/z-k-w');
  await expect(page.getByRole('heading', { name: 'Meaning' })).toBeVisible();
  await expect(page.getByText(/Edward William Lane/)).toBeVisible();
  // The full entry ships in the HTML behind a native expander (crawlable, no-JS).
  const expander = page.locator('details summary', { hasText: /full entry/i });
  await expect(expander).toBeVisible();
});

test('root with no Lane entry shows an explicit no-entry message', async ({
  page,
}) => {
  // د ب ر (root:d-b-r) is genuinely absent from this Perseus digitisation of Lane.
  await page.goto('/root/d-b-r');
  await expect(page.getByRole('heading', { name: 'Meaning' })).toBeVisible();
  await expect(page.getByText(/No entry in Lane/i)).toBeVisible();
});

test('Arabic spaced root redirects to the canonical slug', async ({ page }) => {
  await page.goto(ARABIC_ZKW);
  await expect(page).toHaveURL(/\/root\/z-k-w$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('ز ك و');
});

test('root occurrence pagination is reachable', async ({ page }) => {
  await page.goto('/root/z-k-w');
  const next = page.locator('a[rel="next"]').first();
  await expect(next).toBeVisible();
  await next.click();
  await expect(page).toHaveURL(/\/root\/z-k-w\/page\/2$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('ز ك و');
});
