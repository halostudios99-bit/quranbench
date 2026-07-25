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
    test(`translations are in the server HTML: ${path}`, async ({ page }) => {
      await page.goto(path);
      // Itani (the default reading translation) and a public-domain edition both
      // render as translation figures, each labelled with translator, year and
      // licence. Scope to the rendered figure — the toolbar also lists the editions
      // (collapsed) and would otherwise match the same text.
      const itani = page
        .locator('[data-translation-edition="en-itani"]')
        .first();
      await expect(itani).toBeVisible();
      await expect(itani.getByText(/Talal Itani/)).toBeVisible();
      await expect(itani.locator('[data-provenance="translation"]')).toBeVisible();
      await expect(itani.getByText(/CC BY-NC-ND 4\.0/)).toBeVisible();

      const pickthall = page
        .locator('[data-translation-edition="en-pickthall"]')
        .first();
      await expect(pickthall).toBeVisible();
      await expect(pickthall.getByText(/Marmaduke Pickthall/)).toBeVisible();
    });
  }
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

  test('deselecting an edition persists across reload', async ({ page }) => {
    await page.goto('/1');
    const toolbar = page.getByTestId('reader-toolbar');
    await toolbar.locator('summary').click(); // open the disclosure
    await toolbar.getByLabel(/Talal Itani/).uncheck();
    await toolbar.getByRole('button', { name: 'Apply' }).click();

    await expect(
      page.locator('[data-translation-edition="en-itani"]'),
    ).toHaveCount(0);
    await expect(
      page.locator('[data-translation-edition="en-pickthall"]').first(),
    ).toBeVisible();

    await page.goto('/1');
    await expect(
      page.locator('[data-translation-edition="en-itani"]'),
    ).toHaveCount(0);
  });

  test('Arabic size persists across reload', async ({ page }) => {
    await page.goto('/1');
    const toolbar = page.getByTestId('reader-toolbar');
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

test.describe('reader toolbar with JavaScript', () => {
  test('multi-select persists across a full reload', async ({ page }) => {
    await page.goto('/1');
    await page.getByRole('button', { name: /Translations/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Choose translations' });
    await expect(dialog).toBeVisible();

    await dialog.getByLabel(/Talal Itani/).uncheck();
    // Applied server-side (router.refresh), no verse content fetched client-side.
    await expect(
      page.locator('[data-translation-edition="en-itani"]'),
    ).toHaveCount(0);

    await page.reload();
    await expect(
      page.locator('[data-translation-edition="en-itani"]'),
    ).toHaveCount(0);
    await expect(
      page.locator('[data-translation-edition="en-pickthall"]').first(),
    ).toBeVisible();
  });

  test('the translations panel is focus-trapped and Esc closes it', async ({
    page,
  }) => {
    await page.goto('/1');
    const trigger = page.getByRole('button', { name: /Translations/ });
    await trigger.click();
    const dialog = page.getByRole('dialog');
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
    await page.getByRole('button', { name: 'Arabic size: Large' }).click();
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

  test('no accessibility violations with the translations panel open', async ({
    page,
  }) => {
    await page.goto('/1');
    await page.getByRole('button', { name: /Translations/ }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
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
