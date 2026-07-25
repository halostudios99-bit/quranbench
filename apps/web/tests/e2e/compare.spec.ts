import { expect, test } from '@playwright/test';

// The translation laboratory /compare: server-rendered permalinks for a verse and
// a range, computed divergence detection, and verse-level reverse lookup.

test('renders a single-verse comparison server-side with all editions labelled', async ({
  page,
}) => {
  await page.goto('/compare?v=2:255');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Translation laboratory');
  const verse = page.getByTestId('compare-verse');
  await expect(verse).toHaveCount(1);
  // Each edition is labelled with its translator via the translation ProvenanceTag.
  await expect(verse.locator('[data-provenance="translation"]').first()).toBeVisible();
  await expect(verse.getByText(/Marmaduke Pickthall/)).toBeVisible();
  await expect(verse.getByText(/John Medows Rodwell/)).toBeVisible();
  // Reproducibility: corpus version and the divergence method are shown.
  await expect(page.getByText('How this was computed')).toBeVisible();
});

test('renders a verse range server-side', async ({ page }) => {
  await page.goto('/compare?v=112:1-4');
  await expect(page.getByTestId('compare-verse')).toHaveCount(4);
});

test('divergence flags a materially divergent verse', async ({ page }) => {
  await page.goto('/compare?v=94:5');
  const verse = page.getByTestId('compare-verse');
  await expect(verse).toHaveAttribute('data-divergent', 'true');
  await expect(verse.getByText(/materially divergent/)).toBeVisible();
});

test('divergence does not flag a verse where the editions agree', async ({ page }) => {
  // 96:16 — "the lying sinful forelock" — is rendered near-identically by all three.
  await page.goto('/compare?v=96:16');
  const verse = page.getByTestId('compare-verse');
  await expect(verse).toHaveAttribute('data-divergent', 'false');
  await expect(verse.getByText(/editions agree/)).toBeVisible();
});

test('reverse lookup finds verses and states the verse-level limitation', async ({ page }) => {
  await page.goto('/compare?q=mercy');
  const block = page.getByTestId('reverse-lookup');
  await expect(block).toBeVisible();
  await expect(block.getByText(/render the word/)).toBeVisible();
  await expect(block.getByText(/verse-level/).first()).toBeVisible();
});

test('a comparison is a shareable permalink (canonical url)', async ({ page }) => {
  await page.goto('/compare?v=2:255');
  const canonical = page.locator('link[rel="canonical"]');
  await expect(canonical).toHaveAttribute('href', /\/compare\?v=2:255/);
});
