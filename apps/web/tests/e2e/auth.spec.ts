import { expect, test } from '@playwright/test';

// Nothing moves behind sign-in (CLAUDE.md rule 5). A signed-out visitor must
// reach every public page, and the only thing an account changes is access to a
// user's own work. These run without a database: the public reads degrade to
// empty rather than failing, so reachability does not depend on Postgres.

const PUBLIC_PAGES = [
  '/',
  '/1',
  '/2',
  '/2/page/3',
  '/2/43',
  '/2/43-45',
  '/word/quran%3Atanzil-uthmani%3A2%3A43%3A4',
  '/root/z-k-w',
  '/search?q=root:%D8%B2%20%D9%83%20%D9%88',
  '/compare?v=2:255',
  '/data',
  '/method',
  '/identifiers',
  '/terms/contributor',
  '/investigations',
];

for (const path of PUBLIC_PAGES) {
  test(`signed-out visitor can reach ${path}`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status(), `status for ${path}`).toBeLessThan(400);
    // Not bounced to a login wall.
    expect(new URL(page.url()).pathname).not.toBe('/signin');
    // The header offers an account, it does not demand one.
    await expect(page.getByRole('link', { name: 'Create account' })).toBeVisible();
  });
}

test('the account page requires sign-in and redirects there', async ({ page }) => {
  await page.goto('/account');
  await expect(page).toHaveURL(/\/signin$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/Sign in/);
});

test('signup shows the full contributor terms and an explicit acceptance', async ({
  page,
}) => {
  await page.goto('/signup');
  await expect(page.getByText(/Contributor terms · version/)).toBeVisible();
  // The terms body is rendered in full, not merely linked.
  await expect(page.getByText(/The Quranic text is not yours or ours to license/)).toBeVisible();
  const accept = page.getByRole('checkbox');
  await expect(accept).toBeVisible();
  await expect(accept).not.toBeChecked();
});

test('no external font requests: fonts are self-hosted', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (req) => {
    const url = req.url();
    if (
      /fonts\.googleapis\.com|fonts\.gstatic\.com/.test(url) ||
      (req.resourceType() === 'font' && !url.includes('/fonts/'))
    ) {
      external.push(url);
    }
  });
  await page.goto('/2/43');
  await page.waitForLoadState('networkidle');
  expect(external, `unexpected external font requests: ${external.join(', ')}`).toEqual(
    [],
  );
});
