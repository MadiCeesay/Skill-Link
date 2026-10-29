import { test, expect } from '@playwright/test';
test('service tools match their names and stay stable when the catalog is filtered', async ({ page }) => {
  await page.goto('/services');
  const expected = [['Electrician', 'electrical'], ['Carpenter', 'carpentry'], ['Appliance Repair', 'appliance'], ['Home Cleaning', 'cleaning'], ['Tailor', 'tailoring'], ['Computer Repair', 'technology']];
  for (const [name, kind] of expected) {
    const card = page.locator('.service-card').filter({ has: page.getByRole('heading', { name, exact: true }) });
    await expect(card).toHaveAttribute('data-service-kind', kind);
  }
  await page.getByLabel('Search services').fill('Electrician');
  await expect(page.locator('.service-card')).toHaveCount(1);
  await expect(page.locator('.service-card')).toHaveAttribute('data-service-kind', 'electrical');
  await page.goto('/');
  await expect(page.locator('.category-list a').filter({ hasText: 'Electrician' })).toHaveAttribute('data-service-kind', 'electrical');
});
test('the homepage shows a full-width cooldown and recovers after Retry-After', async ({ page }) => {
  let recovering = false;
  await page.route('**/api/services?*', async route => {
    if (recovering) return route.continue();
    await route.fulfill({ status: 429, contentType: 'application/json', headers: { 'Retry-After': '5', 'X-SkillLink-Rate-Limit': 'global', 'Access-Control-Allow-Origin': 'http://127.0.0.1:5174', 'Access-Control-Expose-Headers': 'Retry-After, X-SkillLink-Rate-Limit' }, body: JSON.stringify({ success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' } }) });
  });
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto('/');
  const feedback = page.locator('.catalog-feedback');
  await expect(feedback).toContainText('Please give SkillLink a moment');
  const retry = feedback.getByRole('button', { name: 'Try again' });
  await expect(retry).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(retry).toBeEnabled({ timeout: 12000 });
  recovering = true;
  await retry.click();
  await expect(page.locator('.category-list a').filter({ hasText: 'Electrician' })).toBeVisible();
});
