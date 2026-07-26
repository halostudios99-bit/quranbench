import { expect, test } from '@playwright/test';

// Pins the findings from the 2026-07-26 audit so they cannot silently regress:
// the security headers, the search-indexing rules, the sitemap index, and the
// structured data on the two page types that were missing it.

test.describe('security headers', () => {
  test('every response carries the policy headers', async ({ request }) => {
    const res = await request.get('/');
    const h = res.headers();

    const csp = h['content-security-policy'];
    expect(csp, 'CSP must be present').toBeTruthy();
    // The substantive directive: this site must not be framable.
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");

    expect(h['x-frame-options']).toBe('DENY');
    expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(h['permissions-policy']).toContain('geolocation=()');
  });

  test('the policy does not break the pages it protects', async ({ page }) => {
    const violations: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && /content security policy/i.test(m.text()))
        violations.push(m.text());
    });
    // A reader page exercises inline hydration, the theme script and the font.
    await page.goto('/2');
    await expect(page.locator('[data-token-id]').first()).toBeVisible();
    // And an interactive surface exercises the client components.
    await page.getByRole('button', { name: 'Reading settings' }).click();
    await expect(
      page.getByRole('dialog', { name: 'Reading settings' }),
    ).toBeVisible();
    expect(violations, violations.join('\n')).toEqual([]);
  });
});

test.describe('search results must not be indexed', () => {
  test('/search is noindex, follow and canonicalises to itself', async ({
    page,
  }) => {
    await page.goto('/search?q=root%3A%D8%B2%20%D9%83%20%D9%88');
    const robots = page.locator('meta[name="robots"]');
    await expect(robots).toHaveAttribute('content', /noindex/);
    // follow is kept so crawlers still reach the word and root pages linked from
    // a result page.
    await expect(robots).toHaveAttribute('content', /follow/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      /\/search$/,
    );
  });

  test('reader and reference pages stay indexable', async ({ page }) => {
    for (const path of ['/', '/2', '/root/z-k-w']) {
      await page.goto(path);
      const robots = page.locator('meta[name="robots"]');
      if ((await robots.count()) > 0) {
        await expect(robots).not.toHaveAttribute('content', /noindex/);
      }
    }
  });
});

test('the homepage has a canonical', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    /quranbench\.com\/?$|localhost:\d+\/?$/,
  );
});

test('/sitemap.xml is a valid index of every shard', async ({ request }) => {
  const res = await request.get('/sitemap.xml');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('xml');
  const body = await res.text();
  expect(body).toContain('<sitemapindex');

  const locs = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
  expect(locs.length).toBeGreaterThanOrEqual(3);

  // Every shard the index advertises must actually exist and carry URLs —
  // an index pointing at a 404 is worse than no index.
  for (const loc of locs) {
    const path = new URL(loc).pathname;
    const shard = await request.get(path);
    expect(shard.status(), `${path} should exist`).toBe(200);
    expect((await shard.text()).includes('<loc>'), `${path} should have URLs`).toBe(
      true,
    );
  }
});

test.describe('structured data on the pages that had none', () => {
  test('the homepage declares WebSite, Organization and Dataset', async ({
    page,
  }) => {
    await page.goto('/');
    const blocks = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents();
    expect(blocks.length).toBeGreaterThan(0);
    const graph = JSON.parse(blocks[0]!)['@graph'] as { '@type': string }[];
    const types = graph.map((n) => n['@type']);
    expect(types).toContain('WebSite');
    expect(types).toContain('Organization');
    expect(types).toContain('Dataset');
    // The search box declaration that makes a sitelinks searchbox eligible.
    expect(blocks[0]).toContain('SearchAction');
  });

  test('a surah page declares itself a Chapter of the Quran', async ({
    page,
  }) => {
    await page.goto('/2');
    const blocks = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents();
    const parsed = blocks.map((b) => JSON.parse(b));
    const chapter = parsed.find((d) => d['@type'] === 'Chapter');
    expect(chapter, 'surah pages should carry Chapter JSON-LD').toBeTruthy();
    expect(chapter.position).toBe(2);
    expect(chapter.isPartOf['@type']).toBe('Book');
    // The edition is named rather than left implicit — the same provenance rule
    // the visible page follows.
    expect(chapter.isPartOf.bookEdition).toContain('Uthmani');
  });
});
