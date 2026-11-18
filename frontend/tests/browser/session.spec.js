import { test, expect } from '@playwright/test';

for (const [role, email, path] of [
  ['customer', 'customer@example.test', '/app/bookings'],
  ['professional', 'professional@example.test', '/work/bookings'],
  ['admin', 'ops@example.test', '/admin/bookings'],
]) {
  test(`${role} keeps its protected route after reload and clears credentials on sign-out`, async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password', { exact: true }).fill('Test-password123');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).not.toHaveURL(/\/login$/);
    await page.goto(path);
    await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
    const old = await page.evaluate(() => localStorage.getItem('skilllink.refreshToken'));
    expect(old).toBeTruthy();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(path + '$'));
    expect(await page.evaluate(() => localStorage.getItem('skilllink.refreshToken'))).not.toBe(old);
    expect(await page.evaluate(() => Object.keys(localStorage))).toEqual(['skilllink.refreshToken']);
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect(await page.evaluate(() => localStorage.getItem('skilllink.refreshToken'))).toBeNull();
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
  });
}

test('invalid stored refresh token returns to sign-in without exposing a protected page', async ({ page }) => {
  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('skilllink.refreshToken', 'invalid-token'));
  await page.goto('/admin/bookings');
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('skilllink.refreshToken'))).toBeNull();
});

test('two tabs serialize rotations and share sign-out', async ({ page, context }) => {
  await page.goto('/login');
  await page.getByLabel('Email address').fill('customer@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Test-password123');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/);
  const other = await context.newPage();
  await Promise.all([page.reload(), other.goto('/app/bookings')]);
  for (const tab of [page, other]) await expect(tab.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(other).toHaveURL(/\/login$/);
});
