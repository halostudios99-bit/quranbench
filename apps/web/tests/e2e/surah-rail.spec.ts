import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// The surah rail beside the reader. It is server-rendered navigation, so it must
// be complete and crawlable with JavaScript disabled; the filter on top of it is
// an enhancement that may only exist when JavaScript does.

test.describe('the rail is real, server-rendered navigation', () => {
  test.use({ javaScriptEnabled: false });

  test('all 114 surahs are links in the server HTML', async ({ page }) => {
    await page.goto('/2');
    const rail = page.getByTestId('surah-rail');
    await expect(rail).toBeVisible();
    await expect(rail.locator('[data-surah-item]')).toHaveCount(114);

    // Real hrefs, not JavaScript handlers.
    await expect(rail.locator('a[href="/1"]')).toHaveCount(1);
    await expect(rail.locator('a[href="/114"]')).toHaveCount(1);
  });

  test('the current surah is marked for assistive technology', async ({
    page,
  }) => {
    await page.goto('/2');
    const rail = page.getByTestId('surah-rail');
    await expect(rail.locator('a[aria-current="page"]')).toHaveCount(1);
    await expect(rail.locator('a[aria-current="page"]')).toHaveAttribute(
      'href',
      '/2',
    );
  });

  test('the rail follows the reader across its surfaces', async ({ page }) => {
    for (const path of ['/2', '/2/page/3', '/2/all']) {
      await page.goto(path);
      await expect(page.getByTestId('surah-rail')).toBeVisible();
    }
  });

  test('the filter is absent without JavaScript rather than inert', async ({
    page,
  }) => {
    await page.goto('/2');
    // A text box that cannot filter would be a lie; only the height-matched
    // placeholder is rendered.
    await expect(
      page.getByTestId('surah-rail').getByRole('searchbox'),
    ).toHaveCount(0);
  });
});

test.describe('the filter, with JavaScript', () => {
  test('narrows the list and restores it when cleared', async ({ page }) => {
    await page.goto('/2');
    const rail = page.getByTestId('surah-rail');
    const filter = rail.getByLabel('Filter surahs by name or number');
    await expect(filter).toBeVisible();

    await filter.fill('maryam');
    await expect(rail.locator('[data-surah-item]:visible')).toHaveCount(1);
    await expect(rail.locator('a[href="/19"]')).toBeVisible();

    await filter.fill('');
    await expect(rail.locator('[data-surah-item]:visible')).toHaveCount(114);
  });

  test('matches on surah number as well as name', async ({ page }) => {
    await page.goto('/2');
    const rail = page.getByTestId('surah-rail');
    await rail.getByLabel('Filter surahs by name or number').fill('114');
    await expect(rail.locator('a[href="/114"]')).toBeVisible();
    await expect(rail.locator('[data-surah-item]:visible')).toHaveCount(1);
  });

  test('says so when nothing matches', async ({ page }) => {
    await page.goto('/2');
    const rail = page.getByTestId('surah-rail');
    await rail.getByLabel('Filter surahs by name or number').fill('zzzzz');
    await expect(rail.locator('[data-surah-item]:visible')).toHaveCount(0);
    await expect(rail.getByText('No surah matches that.')).toBeVisible();
  });

  test('no accessibility violations with the rail present', async ({ page }) => {
    await page.goto('/2');
    await expect(page.getByTestId('surah-rail')).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});

test('the rail does not narrow the reading column below its measure', async ({
  page,
}) => {
  await page.goto('/2');
  await expect(page.getByTestId('surah-rail')).toBeVisible();
  const width = await page
    .locator('[data-reader-root]')
    .evaluate((n) => n.getBoundingClientRect().width);
  // The reader keeps a readable measure beside the rail rather than being
  // squeezed by it.
  expect(width).toBeGreaterThan(600);
});
