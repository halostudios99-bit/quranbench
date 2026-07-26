import { expect, test } from '@playwright/test';

// The password-reset entry points render server-side and are reachable without an
// account. The full token round-trip (issue → reset → sessions invalidated) is
// proven in tests/unit/password-reset.test.ts; here we check the public surfaces
// exist, are linked, and degrade safely.

test('the sign-in page links to password reset', async ({ page }) => {
  await page.goto('/signin');
  await expect(
    page.getByRole('link', { name: /Forgot your password/i }),
  ).toHaveAttribute('href', '/forgot-password');
});

test('the forgot-password page renders a reset request form', async ({ page }) => {
  await page.goto('/forgot-password');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    /Reset your password/i,
  );
  await expect(page.locator('input[name="email"]')).toBeVisible();
  await expect(page.locator('input[name="csrf"]')).toHaveCount(1);
});

test('the reset page without a token guides the user to request one', async ({
  page,
}) => {
  await page.goto('/reset-password');
  await expect(page.locator('p[role="alert"]')).toContainText(/reset link/i);
  await expect(
    page.getByRole('link', { name: /reset your password/i }),
  ).toBeVisible();
});
