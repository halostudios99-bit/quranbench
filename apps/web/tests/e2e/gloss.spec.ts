import { expect, test } from '@playwright/test';

// Reverse gloss lookup: Leeds glosses carry sentence punctuation and bracketed
// helpers, so one word arrives spelled many ways. The key folds them; the raw
// URLs redirect to one canonical page, which still shows the verbatim variants.

test('punctuation and bracket variants of one gloss resolve to one page', async ({
  page,
}) => {
  // The four variants from the corpus (v0.8.0), each as a raw URL.
  const rawVariants = [
    'the zakah',
    'the zakah,',
    'the zakah."',
    '[the] zakah.',
  ];

  for (const variant of rawVariants) {
    await page.goto(`/gloss/${encodeURIComponent(variant)}`);
    // All redirect to the single canonical slug.
    await expect(page).toHaveURL(/\/gloss\/the-zakah$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/zakah/);
  }
});

test('the canonical gloss page shows the verbatim surface forms it merged', async ({
  page,
}) => {
  await page.goto('/gloss/the-zakah');
  await expect(page).toHaveURL(/\/gloss\/the-zakah$/);
  const merged = page.getByText('Merged surface forms');
  await expect(merged).toBeVisible();
  // The raw, punctuation-bearing strings are shown unaltered.
  await expect(page.getByText('“the zakah,”')).toBeVisible();
  await expect(page.getByText('“[the] zakah.”')).toBeVisible();
});

test('a raw punctuated variant redirects to the canonical slug', async ({
  page,
}) => {
  // A trailing-punctuation variant folds to the same key and redirects.
  await page.goto('/gloss/reward.');
  await expect(page).toHaveURL(/\/gloss\/reward$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/reward/);
});

test('the gloss index ranks by distinct root count and links to canonical slugs', async ({
  page,
}) => {
  await page.goto('/gloss');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/Glosses/);

  const rows = page.getByRole('list').getByRole('link');
  const count = await rows.count();
  expect(count).toBeGreaterThan(1);

  // Read the "N roots" figure off the first two rows: rank is non-increasing.
  const rootsOf = async (i: number): Promise<number> => {
    const text = (await rows.nth(i).innerText()).match(/(\d+)\s+roots?/);
    return text ? Number(text[1]) : 0;
  };
  expect(await rootsOf(0)).toBeGreaterThanOrEqual(await rootsOf(1));
  expect(await rootsOf(0)).toBeGreaterThan(1);

  // Every row links to a hyphenated, punctuation-free canonical slug.
  const href = await rows.first().getAttribute('href');
  expect(href).toMatch(/^\/gloss\/[a-z0-9'-]+$/);
});
