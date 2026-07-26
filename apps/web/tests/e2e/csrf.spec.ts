import { expect, test } from '@playwright/test';

// CSRF: every state-changing form carries a double-submit token, and the route
// handlers that receive a native POST reject a submission without a matching one.
// The rejection path runs before any database write, so this holds with no DB.

test('state-changing forms embed a CSRF token', async ({ page }) => {
  for (const path of ['/report', '/signin', '/signup', '/forgot-password']) {
    await page.goto(path);
    const token = await page
      .locator('input[name="csrf"]')
      .first()
      .getAttribute('value');
    expect(token, `csrf token on ${path}`).toBeTruthy();
    expect((token ?? '').length, `csrf token length on ${path}`).toBeGreaterThan(16);
  }
});

test('a forged POST to /report/submit without a token is rejected', async ({
  request,
}) => {
  // No csrf field, and the request context carries no qb_csrf cookie: this is a
  // forged cross-site submission. It must bounce back to the form with an error,
  // never reach the moderation queue.
  const res = await request.post('/report/submit', {
    form: { path: '/2/43', problem: 'forged submission' },
    maxRedirects: 0,
  });
  expect(res.status()).toBe(303);
  expect(res.headers()['location']).toContain('error=csrf');
});
