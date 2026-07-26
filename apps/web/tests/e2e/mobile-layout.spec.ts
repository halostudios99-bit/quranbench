import { expect, test } from '@playwright/test';

// The guard that did not exist when the header shipped.
//
// The mobile e2e projects only ran render.spec and tooltip.spec, and neither
// compared layout width against the viewport. So a header that needed 408px in a
// 360px viewport — clipping "Create account" and pushing the theme toggle
// entirely off-screen — passed every check for weeks.
//
// 360px is the narrowest width in common use. Everything here runs at that width
// regardless of the project's own viewport, so the guard holds even if the
// mobile projects are reconfigured.

const NARROW = { width: 360, height: 740 };

const PAGES = [
  '/',
  '/2',
  '/2/page/3',
  '/1/1',
  '/word/quran%3Atanzil-uthmani%3A2%3A43%3A4',
  '/root/z-k-w',
  '/search?q=root%3A%D8%B2%20%D9%83%20%D9%88',
  '/compare',
  '/data',
  '/method',
  '/about',
  '/investigations',
  '/signup',
  '/signin',
  '/report',
];

test.describe('nothing overflows a 360px viewport', () => {
  test.use({ viewport: NARROW });

  for (const path of PAGES) {
    test(`no element escapes the viewport: ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);

      // Name the offenders rather than just failing on a number — a bare
      // "409 > 360" tells the next person nothing about what to fix.
      const escaping = await page.evaluate((vw) => {
        const out: { tag: string; cls: string; right: number; text: string }[] = [];
        for (const el of Array.from(document.querySelectorAll('body *'))) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (r.right <= vw + 1) continue;
          // Content inside something that scrolls or clips on purpose is fine,
          // and so is the content of a *closed* <details>: Chrome still gives it
          // layout boxes at the summary's position, but nobody can see or reach
          // it until the disclosure is opened. Measuring it would make the
          // mobile menu permanently fail this test for markup that is not on
          // screen.
          let contained = false;
          for (let p = el.parentElement; p; p = p.parentElement) {
            const ox = getComputedStyle(p).overflowX;
            if (ox === 'auto' || ox === 'scroll' || ox === 'hidden') {
              contained = true;
              break;
            }
            if (p.tagName === 'DETAILS' && !(p as HTMLDetailsElement).open) {
              contained = true;
              break;
            }
          }
          if (contained) continue;
          out.push({
            tag: el.tagName.toLowerCase(),
            cls: String((el as HTMLElement).className || '').slice(0, 60),
            right: Math.round(r.right),
            text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40),
          });
        }
        return out;
      }, NARROW.width);

      expect(
        escaping,
        escaping.map((e) => `<${e.tag} class="${e.cls}"> right=${e.right} "${e.text}"`).join('\n'),
      ).toEqual([]);
    });
  }
});

test.describe('the mobile header', () => {
  test.use({ viewport: NARROW });

  test('every header control is reachable on screen', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    // The page is not horizontally scrollable, so anything past the right edge
    // is not merely awkward — it cannot be reached at all.
    for (const el of await page.locator('header a, header summary').all()) {
      if (!(await el.isVisible())) continue;
      const box = await el.boundingBox();
      if (!box) continue;
      expect(
        box.x + box.width,
        `"${(await el.textContent())?.trim() || 'icon'}" extends past the viewport`,
      ).toBeLessThanOrEqual(NARROW.width + 1);
    }
  });

  test('the menu opens without JavaScript and reaches the rest of the site', async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ viewport: NARROW, javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto('/');

    // Scope to the menu: the desktop nav renders the same links and is merely
    // hidden by CSS, so an unscoped locator matches twice.
    const menu = page.getByTestId('mobile-menu');
    await expect(menu).toBeVisible();
    // Closed to begin with: the links must not be reachable until asked for.
    await expect(menu.getByRole('link', { name: 'All surahs' })).toBeHidden();

    await menu.locator('summary').click();
    await expect(menu.getByRole('link', { name: 'All surahs' })).toBeVisible();
    await expect(menu.getByRole('link', { name: 'Method' })).toBeVisible();
    // Sign-in must be reachable on a phone; it was pushed off-screen before.
    await expect(menu.getByRole('link', { name: 'Sign in' })).toBeVisible();
    await ctx.close();
  });

  test('search stays one tap away, outside the menu', async ({ page }) => {
    await page.goto('/');
    const search = page.getByTestId('mobile-search');
    await expect(search).toBeVisible();
    const box = await search.boundingBox();
    // A primary control should meet the 44px platform guidance, not just 24px.
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test('the open menu stays inside the viewport', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const menu = page.getByTestId('mobile-menu');
    await menu.locator('summary').click();
    const escaping = await page.evaluate((vw) => {
      const panel = document.querySelector<HTMLElement>(
        '[data-testid="mobile-menu"] > div',
      );
      if (!panel) return ['panel missing'];
      const out: string[] = [];
      const r = panel.getBoundingClientRect();
      if (r.right > vw + 1) out.push(`panel right=${Math.round(r.right)}`);
      for (const el of Array.from(panel.querySelectorAll('*'))) {
        const b = el.getBoundingClientRect();
        if (b.width && b.right > vw + 1)
          out.push(`${el.tagName.toLowerCase()} right=${Math.round(b.right)}`);
      }
      return out;
    }, NARROW.width);
    expect(escaping, escaping.join(', ')).toEqual([]);
  });
});

test.describe('iOS does not zoom the page on focus', () => {
  test.use({ viewport: NARROW });

  // Safari on iOS magnifies the viewport whenever a focused field is under 16px,
  // and does not undo it. Every field a phone user can reach must be >= 16px.
  for (const path of ['/signup', '/signin', '/report', '/compare', '/gloss', '/search']) {
    test(`every input is at least 16px: ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      const small = await page.evaluate(() =>
        Array.from(document.querySelectorAll('input, select, textarea'))
          .filter((el) => {
            const s = getComputedStyle(el);
            if (s.display === 'none' || s.visibility === 'hidden') return false;
            if ((el as HTMLInputElement).type === 'hidden') return false;
            if ((el as HTMLInputElement).type === 'checkbox') return false;
            return parseFloat(s.fontSize) < 16;
          })
          .map((el) => ({
            name: el.getAttribute('name') || el.getAttribute('aria-label') || el.tagName,
            size: getComputedStyle(el).fontSize,
          })),
      );
      expect(small, JSON.stringify(small)).toEqual([]);
    });
  }
});
