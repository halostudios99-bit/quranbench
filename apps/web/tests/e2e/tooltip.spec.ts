import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// The token hover/tap tooltip (design-system §3, workplan item 7). It is
// progressive enhancement layered on the one <Token> renderer, so it must appear
// on the reader without that page being modified, must not shift layout, must stay
// inside the viewport, must be keyboard-operable and Esc-dismissable, and must not
// animate the Arabic. Coarse-pointer devices get a bottom sheet instead of a box.

// The axe case scans a reader page with the tooltip open, which runs close to
// the default 30s budget and flakes past it under load. Assertions unchanged.
test.describe.configure({ timeout: 120_000 });

const FIRST_TOKEN = '[data-token-id="quran:tanzil-uthmani:1:1:1"]';

async function isCoarse(
  page: import('@playwright/test').Page,
): Promise<boolean> {
  return page.evaluate(() => window.matchMedia('(pointer: coarse)').matches);
}

// The Arabic web font reflows the page once it swaps in. Any layout measurement
// (scrollHeight, bounding boxes) must wait for that to settle first, or it races
// the font load and flakes. This is a deterministic signal, not a sleep.
async function fontsReady(
  page: import('@playwright/test').Page,
): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
}

test('token carries the gloss data in the page, not a fetch', async ({
  page,
}) => {
  // The data ships in the HTML — assert it is present before any interaction.
  await page.goto('/1');
  const el = page.locator(FIRST_TOKEN).first();
  await expect(el).toHaveAttribute('data-gloss', 'In (the) name');
  await expect(el).toHaveAttribute('data-translit', "bis'mi");
  await expect(el).toHaveAttribute('data-root-slug', 's-m-w');
});

test('desktop hover shows gloss, transliteration, root link and a source label', async ({
  page,
}) => {
  await page.goto('/1');
  if (await isCoarse(page)) test.skip();
  await fontsReady(page);
  const token = page.locator(FIRST_TOKEN).first();

  const before = await page.evaluate(
    () => document.documentElement.scrollHeight,
  );
  await token.hover();
  const tip = page.locator('#qb-token-tooltip');
  await expect(tip).toBeVisible();
  await expect(tip).toContainText("bis'mi");
  await expect(tip).toContainText('In (the) name');
  await expect(tip.locator('a[href="/root/s-m-w"]')).toBeVisible();
  await expect(tip).toContainText('Quranic Arabic Corpus');

  // No layout shift: the tooltip is a fixed overlay; the page height is unchanged.
  const after = await page.evaluate(
    () => document.documentElement.scrollHeight,
  );
  expect(after).toBe(before);
  const position = await tip.evaluate((n) => getComputedStyle(n).position);
  expect(position).toBe('fixed');

  // Clamped inside the viewport (flip + clamp), never overflowing.
  const box = await tip.boundingBox();
  const vw = page.viewportSize()!;
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(-1);
  expect(box!.y).toBeGreaterThanOrEqual(-1);
  expect(box!.x + box!.width).toBeLessThanOrEqual(vw.width + 1);
});

test('keyboard: focusing a token shows the tooltip, Esc dismisses it', async ({
  page,
}) => {
  await page.goto('/1');
  if (await isCoarse(page)) test.skip();
  const token = page.locator(FIRST_TOKEN).first();
  await token.focus();
  const tip = page.locator('#qb-token-tooltip');
  await expect(tip).toBeVisible();
  await expect(tip).toContainText('In (the) name');
  await page.keyboard.press('Escape');
  await expect(tip).toHaveCount(0);
  // Focus returns to the token it came from.
  await expect(token).toBeFocused();
});

test('the tooltip is axe-clean while open', async ({ page }) => {
  await page.goto('/1');
  if (await isCoarse(page)) test.skip();
  await page.locator(FIRST_TOKEN).first().focus();
  // The tooltip is progressive enhancement, so it cannot appear until the client
  // controller has hydrated. Focusing a token immediately after load races that,
  // and the default 5s assertion budget loses the race whenever the machine is
  // busy — which is why a different tooltip test flaked on each full run. A
  // longer budget waits for hydration; a tooltip that never appears still fails.
  await expect(page.locator('#qb-token-tooltip')).toBeVisible({ timeout: 20_000 });
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});

test('reduced motion is honoured: the tooltip still appears', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/1');
  if (await isCoarse(page)) test.skip();
  await page.locator(FIRST_TOKEN).first().focus();
  // The tooltip is progressive enhancement, so it cannot appear until the client
  // controller has hydrated. Focusing a token immediately after load races that,
  // and the default 5s assertion budget loses the race whenever the machine is
  // busy — which is why a different tooltip test flaked on each full run. A
  // longer budget waits for hydration; a tooltip that never appears still fails.
  await expect(page.locator('#qb-token-tooltip')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('#qb-token-tooltip')).toContainText(
    'In (the) name',
  );
});

test('mobile: a tap opens a bottom sheet, not a floating box', async ({
  page,
}) => {
  await page.goto('/1');
  if (!(await isCoarse(page))) test.skip();
  await page.locator(FIRST_TOKEN).first().tap();
  const sheet = page.locator('[role="dialog"]#qb-token-tooltip');
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText('In (the) name');
  // The sheet offers the word page explicitly (the tap did not navigate).
  await expect(sheet.locator('a[href*="/word/"]')).toBeVisible();
  await expect(page).toHaveURL(/\/1$/);
});
