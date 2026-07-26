import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// Translations on the reader (Batch 1). Every reader surface renders the licensed
// editions server-side; the toolbar chooses which editions show, the display mode
// and the Arabic size; every choice persists and every control works with
// JavaScript disabled.

test.describe('translations render server-side on every reader surface', () => {
  test.use({ javaScriptEnabled: false });

  const surfaces = ['/1', '/2', '/2/page/3', '/2/all', '/2/43'];
  for (const path of surfaces) {
    test(`the default translation is in the server HTML: ${path}`, async ({
      page,
    }) => {
      await page.goto(path);
      // A reader who has never chosen sees exactly one edition — Pickthall —
      // rendered as a translation figure labelled with translator, year and
      // licence. Scope to the rendered figure: the no-JS toolbar also lists the
      // editions (collapsed) and would otherwise match the same text.
      const pickthall = page
        .locator('[data-translation-edition="en-pickthall"]')
        .first();
      await expect(pickthall).toBeVisible();
      await expect(pickthall.getByText(/Marmaduke Pickthall/)).toBeVisible();
      await expect(
        pickthall.locator('[data-provenance="translation"]'),
      ).toBeVisible();

      // The others are available but not shown until asked for.
      await expect(
        page.locator('[data-translation-edition="en-itani"]'),
      ).toHaveCount(0);
      await expect(
        page.locator('[data-translation-edition="en-rodwell"]'),
      ).toHaveCount(0);
    });
  }

  test('selecting every edition still renders them all server-side', async ({
    page,
    context,
  }) => {
    // The `all` sentinel is what an explicit "show everything" looks like, and it
    // must survive with JavaScript off — including the display-only edition, which
    // is served to readers even though it is excluded from every download.
    await context.addCookies([
      { name: 'qb_translations', value: 'all', url: 'http://localhost:3100' },
    ]);
    await page.goto('/1');
    for (const id of ['en-pickthall', 'en-rodwell', 'en-palmer']) {
      await expect(
        page.locator(`[data-translation-edition="${id}"]`).first(),
      ).toBeVisible();
    }

    // Itani is gitignored and fetched at build time, so a clean checkout serves
    // one translation fewer. Assert it only where it was actually loaded —
    // otherwise this test passes on a developer's machine and fails in CI, which
    // is what it did.
    const itani = page.locator('[data-translation-edition="en-itani"]').first();
    if ((await itani.count()) > 0) {
      await expect(itani).toBeVisible();
      await expect(itani.getByText(/CC BY-NC-ND 4\.0/)).toBeVisible();
    }
  });
});

test.describe('reader preferences persist without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('display mode → Arabic only hides translations and survives reload', async ({
    page,
  }) => {
    await page.goto('/1');
    await expect(
      page.locator('[data-testid="verse-translations"]').first(),
    ).toBeVisible();

    const toolbar = page.getByTestId('reader-toolbar');
    await toolbar.locator('summary').click(); // open the disclosure
    await toolbar.getByLabel('Arabic only').check();
    await toolbar.getByRole('button', { name: 'Apply' }).click();

    await expect(page).toHaveURL(/\/1$/);
    await expect(page.locator('[data-testid="verse-translations"]')).toHaveCount(0);
    // Arabic itself is still present.
    await expect(page.locator('[data-token-id]').first()).toBeVisible();

    // A fresh navigation still honours the saved preference (cookie).
    await page.goto('/1');
    await expect(page.locator('[data-testid="verse-translations"]')).toHaveCount(0);
  });

  test('adding an edition persists across reload', async ({ page }) => {
    await page.goto('/1');
    // Only the default is shown to begin with.
    await expect(
      page.locator('[data-translation-edition="en-rodwell"]'),
    ).toHaveCount(0);

    const toolbar = page.getByTestId('reader-toolbar');
    await toolbar.locator('summary').click(); // open the disclosure
    await toolbar.getByLabel(/John Medows Rodwell/).check();
    await toolbar.getByRole('button', { name: 'Apply' }).click();

    await expect(
      page.locator('[data-translation-edition="en-rodwell"]').first(),
    ).toBeVisible();
    await expect(
      page.locator('[data-translation-edition="en-pickthall"]').first(),
    ).toBeVisible();

    await page.goto('/1');
    await expect(
      page.locator('[data-translation-edition="en-rodwell"]').first(),
    ).toBeVisible();
  });

  test('Arabic size persists across reload', async ({ page }) => {
    await page.goto('/1');
    const toolbar = page.getByTestId('reader-toolbar');
    await toolbar.locator('summary').click(); // open the disclosure
    await toolbar.getByLabel('Large').check();
    await toolbar.getByRole('button', { name: 'Apply' }).click();

    await expect(page.locator('[data-reader-root]')).toHaveAttribute(
      'style',
      /--qb-arabic-scale:\s*1\.13/,
    );
    await page.goto('/1');
    await expect(page.locator('[data-reader-root]')).toHaveAttribute(
      'style',
      /--qb-arabic-scale:\s*1\.13/,
    );
  });
});

test.describe('reader settings panel with JavaScript', () => {
  const openPanel = async (page: import('@playwright/test').Page) => {
    await page.getByRole('button', { name: 'Reading settings' }).click();
    const dialog = page.getByRole('dialog', { name: 'Reading settings' });
    await expect(dialog).toBeVisible();
    return dialog;
  };

  test('adding an edition persists across a full reload', async ({ page }) => {
    await page.goto('/1');
    const dialog = await openPanel(page);

    await dialog.getByLabel(/John Medows Rodwell/).check();
    // Applied server-side (router.refresh), no verse content fetched client-side.
    await expect(
      page.locator('[data-translation-edition="en-rodwell"]').first(),
    ).toBeVisible();

    await page.reload();
    await expect(
      page.locator('[data-translation-edition="en-rodwell"]').first(),
    ).toBeVisible();
    await expect(
      page.locator('[data-translation-edition="en-pickthall"]').first(),
    ).toBeVisible();
  });

  test('Reset returns the reader to a single default translation', async ({
    page,
  }) => {
    await page.goto('/1');
    let dialog = await openPanel(page);
    await dialog.getByLabel(/John Medows Rodwell/).check();
    await expect(
      page.locator('[data-translation-edition="en-rodwell"]').first(),
    ).toBeVisible();

    dialog = page.getByRole('dialog', { name: 'Reading settings' });
    await dialog.getByRole('button', { name: 'Reset' }).click();
    await expect(
      page.locator('[data-translation-edition="en-rodwell"]'),
    ).toHaveCount(0);
    await expect(
      page.locator('[data-translation-edition="en-pickthall"]').first(),
    ).toBeVisible();
  });

  test('the settings panel is focus-trapped and Esc closes it', async ({
    page,
  }) => {
    await page.goto('/1');
    const trigger = page.getByRole('button', { name: 'Reading settings' });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Reading settings' });
    await expect(dialog).toBeVisible();
    // Focus moved into the panel on open.
    await expect(dialog.locator(':focus')).toBeVisible();
    // Esc closes and returns focus to the trigger.
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('Arabic size applies via a CSS variable and persists', async ({ page }) => {
    await page.goto('/1');
    const dialog = await openPanel(page);
    await dialog.getByRole('button', { name: 'Arabic size: Large' }).click();
    await expect(page.locator('[data-reader-root]')).toHaveAttribute(
      'style',
      /--qb-arabic-scale:\s*1\.13/,
    );
    await page.reload();
    await expect(page.locator('[data-reader-root]')).toHaveAttribute(
      'style',
      /--qb-arabic-scale:\s*1\.13/,
    );
  });

  test('no accessibility violations with the settings panel open', async ({
    page,
  }) => {
    await page.goto('/1');
    await openPanel(page);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});

test('the data page names Itani as display-only', async ({ page }) => {
  await page.goto('/data');
  await expect(
    page.getByRole('heading', { name: /Display-only translations/ }),
  ).toBeVisible();
  await expect(page.getByText(/Talal Itani/).first()).toBeVisible();
  await expect(page.getByText(/not.*part of the dataset/i).first()).toBeVisible();
});
