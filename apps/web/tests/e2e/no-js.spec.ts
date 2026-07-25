import { expect, test } from '@playwright/test';

// Rule 3 (CLAUDE.md): every public page must render complete content with
// JavaScript disabled. We prove it by loading each page type in a context with
// scripting turned off and asserting the real content is present in the DOM the
// server sent — the Arabic, the headings, the references.
test.use({ javaScriptEnabled: false });

const PAGES: { path: string; heading: RegExp }[] = [
  { path: '/', heading: /Search the Quran/ },
  { path: '/1', heading: /Surah 1/ },
  { path: '/2', heading: /Surah 2/ }, // paginated reader, page 1
  { path: '/2/page/3', heading: /Surah 2/ }, // a paginated middle page
  { path: '/2/43', heading: /2:43/ },
  { path: '/2/43-45', heading: /2:43-45/ },
  { path: '/word/quran%3Atanzil-uthmani%3A2%3A43%3A4', heading: /[؀-ۿ]/ },
  { path: '/root/z-k-w', heading: /ز ك و/ },
  { path: '/search?q=root:%D8%B2%20%D9%83%20%D9%88', heading: /Search/ },
  { path: '/compare?v=2:255', heading: /Translation laboratory/ },
];

for (const { path, heading } of PAGES) {
  test(`renders full content without JavaScript: ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      heading,
    );
    // Arabic content is in the server HTML, not injected by client JS.
    await expect(page.locator('[data-token-id]').first()).toBeVisible();
  });
}

// The infrastructure pages (Part C/D) carry no Arabic tokens, so they are
// checked separately: their substance must still be in the server HTML.
test('the data page lists downloads and a citation without JavaScript', async ({
  page,
}) => {
  await page.goto('/data');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    /Download the dataset/,
  );
  await expect(
    page.getByRole('link', { name: 'verses.jsonl' }).first(),
  ).toBeVisible();
  // One citation per published version — assert the first is server-rendered.
  await expect(page.getByText(/Quran corpus, version/).first()).toBeVisible();
  await expect(page.getByText(/sha256\(manifest\.json\)=/).first()).toBeVisible();
});

test('the method page renders its explanation without JavaScript', async ({
  page,
}) => {
  await page.goto('/method');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    /How this is built/,
  );
  await expect(page.getByText(/Known limitations/)).toBeVisible();
  await expect(page.getByText(/verse-level/i).first()).toBeVisible();
});

test('surah navigation links work without JavaScript', async ({ page }) => {
  await page.goto('/2/43');
  await page.getByRole('link', { name: /^All of/ }).click();
  await expect(page).toHaveURL(/\/2$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Surah 2',
  );
});
