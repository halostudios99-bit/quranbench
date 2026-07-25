import { expect, test } from '@playwright/test';

// Part E acceptance: the service worker registers, and once the app shell and a
// page are cached, that page is still reachable with the network cut. Full
// offline *search* is deliberately not claimed — this proves offline *reading*.

test('registers a service worker and serves a cached page offline', async ({
  page,
  context,
}) => {
  await page.goto('/');
  const registered = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return false;
    const reg = await navigator.serviceWorker.ready;
    return !!reg.active;
  });
  expect(registered).toBe(true);

  // Visit a corpus page so it enters the runtime page cache.
  await page.goto('/2/255');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('2:255');
  // Give the SW a moment to store the navigation response.
  await page.waitForTimeout(500);

  // Cut the network and revisit the cached page: it still reads offline. This
  // is the Part E acceptance criterion — offline reading of cached pages.
  await context.setOffline(true);
  await page.goto('/2/255');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('2:255');

  // The offline shell itself is precached, so it is reachable with no network.
  await page.goto('/offline');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    /offline/i,
  );

  await context.setOffline(false);
});

test('the manifest advertises maskable PNG icons at 192 and 512', async ({
  request,
}) => {
  const manifest = await request.get('/manifest.webmanifest');
  expect(manifest.ok()).toBe(true);
  const body = (await manifest.json()) as {
    icons: { sizes: string; purpose?: string }[];
  };
  const maskable = body.icons.filter((i) => i.purpose?.includes('maskable'));
  const sizes = maskable.map((i) => i.sizes);
  expect(sizes).toContain('192x192');
  expect(sizes).toContain('512x512');

  for (const size of [192, 512]) {
    const png = await request.get(`/icon-${size}.png`);
    expect(png.ok()).toBe(true);
    expect(png.headers()['content-type']).toContain('image/png');
  }
});
