import { test, expect } from '@playwright/test';

test('unfinished recovery routes return to sign-in without offering password recovery', async ({ page }) => {
  for (const path of ['/login', '/forgot-password', '/reset-password?token=unused', '/account-verification']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: /forgot password/i })).toHaveCount(0);
  }
});
