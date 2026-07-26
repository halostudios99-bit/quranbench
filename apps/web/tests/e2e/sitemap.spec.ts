import { expect, test } from '@playwright/test';

// Segmented sitemaps cover every word and root page. We spot-check a sample from
// each segment resolves 200 — we do not crawl all ~79,500 URLs.

function locs(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
}

function sample<T>(items: T[], n: number): T[] {
  if (items.length <= n) return items;
  const step = Math.floor(items.length / n);
  return Array.from({ length: n }, (_, i) => items[i * step]!);
}

test('segment 0 carries the reader surfaces and roots; a sample resolves 200', async ({
  request,
}) => {
  const res = await request.get('/sitemap/0.xml');
  expect(res.status()).toBe(200);
  const urls = locs(await res.text());
  expect(urls.length).toBeGreaterThan(6000); // surahs + verses + roots
  expect(urls.some((u) => u.endsWith('/root/z-k-w'))).toBe(true);
  expect(urls.some((u) => u.endsWith('/gloss'))).toBe(true); // the gloss index
  // Multi-root glosses are advertised by canonical slug (hyphenated, punctuation-free).
  expect(urls.some((u) => /\/gloss\/[a-z0-9'-]+$/.test(new URL(u).pathname))).toBe(
    true,
  );

  for (const url of sample(urls, 12)) {
    // Sitemap URLs are absolute (production origin); test the path locally.
    const path = new URL(url).pathname;
    const r = await request.get(path);
    expect(r.status(), path).toBe(200);
  }
});

test('word sitemap segments exist and a sample resolves 200', async ({
  request,
}) => {
  const res = await request.get('/sitemap/1.xml');
  expect(res.status()).toBe(200);
  const urls = locs(await res.text());
  expect(urls.length).toBeGreaterThan(1000);
  expect(urls.every((u) => u.includes('/word/'))).toBe(true);

  for (const url of sample(urls, 10)) {
    // Sitemap URLs are absolute (production origin); test the path locally.
    const path = new URL(url).pathname;
    const r = await request.get(path);
    expect(r.status(), path).toBe(200);
  }
});
