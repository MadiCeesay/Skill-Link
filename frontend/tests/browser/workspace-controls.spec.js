import { test, expect } from '@playwright/test';
const api = 'http://127.0.0.1:5001/api';
async function login(page, email) {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('Test-password123');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}
test('availability presets, equal dashboard actions and server-side People filters on desktop and phone', async ({ browser }) => {
  test.setTimeout(240000);
  for (const width of [1440, 375]) {
    const context = await browser.newContext({ viewport: { width, height: 950 } });
    const page = await context.newPage();
    await login(page, 'professional@example.test');
    await page.goto('/work/availability');
    await page.getByRole('button', { name: 'Mon to Sat 8am to 6pm', exact: true }).click();
    const sunday = page.locator('.day-row').filter({ has: page.getByText('Sunday', { exact: true }) });
    const monday = page.locator('.day-row').filter({ has: page.getByText('Monday', { exact: true }) });
    const saturday = page.locator('.day-row').filter({ has: page.getByText('Saturday', { exact: true }) });
    await expect(sunday).toContainText('Not working');
    await expect(monday.getByLabel('Start', { exact: true })).toHaveValue('08:00');
    await monday.getByRole('button', { name: 'Add hours', exact: true }).click();
    const starts = monday.getByLabel('Start', { exact: true }), ends = monday.getByLabel('End', { exact: true });
    await starts.nth(0).fill('08:00'); await ends.nth(0).fill('12:00');
    await starts.nth(1).fill('13:00'); await ends.nth(1).fill('17:00');
    await page.getByRole('button', { name: 'Copy Monday hours to all weekdays', exact: true }).click();
    for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) {
      const row = page.locator('.day-row').filter({ has: page.getByText(day, { exact: true }) });
      await expect(row.getByLabel('Start', { exact: true })).toHaveCount(2);
      await expect(row.getByLabel('Start', { exact: true }).nth(1)).toHaveValue('13:00');
    }
    await expect(saturday.getByLabel('End', { exact: true })).toHaveValue('18:00');
    const saved = page.waitForResponse(r => r.url().endsWith('/availability/me') && r.request().method() === 'PATCH');
    await page.getByRole('button', { name: 'Save availability', exact: true }).click();
    expect((await saved).ok()).toBe(true);
    await page.reload();
    await expect(monday.getByLabel('Start', { exact: true })).toHaveCount(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/availability-presets-${width}.png`, fullPage: true });
    await context.close();

    const customer = await browser.newContext({ viewport: { width, height: 950 } }), customerPage = await customer.newPage();
    await login(customerPage, 'customer@example.test');
    const heading = customerPage.locator('.page-title');
    const find = heading.getByRole('link', { name: 'Find a professional', exact: true }), post = heading.getByRole('link', { name: 'Post request', exact: true });
    await expect(find).toBeVisible(); await expect(post).toBeVisible();
    expect(await find.getAttribute('class')).toBe(await post.getAttribute('class'));
    await expect(find).toHaveAttribute('href', '/professionals');
    expect(await customerPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await customerPage.screenshot({ path: `test-results/customer-actions-${width}.png`, fullPage: true });
    await customer.close();

    const admin = await browser.newContext({ viewport: { width, height: 950 } }), adminPage = await admin.newPage();
    await login(adminPage, 'ops@example.test');
    await adminPage.goto('/admin/users');
    await adminPage.getByLabel('Search by name').fill('Lamin');
    const searched = adminPage.waitForResponse(r => r.url().startsWith(api + '/admin/users?') && new URL(r.url()).searchParams.get('q') === 'Lamin');
    await adminPage.getByRole('button', { name: 'Search', exact: true }).click();
    expect((await searched).ok()).toBe(true);
    await expect(adminPage.getByText('Lamin Jallow', { exact: true })).toBeVisible();
    await adminPage.getByLabel('Role', { exact: true }).selectOption('CUSTOMER');
    await expect(adminPage.getByText('No people match your search', { exact: true })).toBeVisible();
    await adminPage.getByLabel('Role', { exact: true }).selectOption('WORKER');
    await expect(adminPage.getByText('Lamin Jallow', { exact: true })).toBeVisible();
    expect(await adminPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await adminPage.screenshot({ path: `test-results/people-search-${width}.png`, fullPage: true });
    await adminPage.getByRole('button', { name: 'Clear filters', exact: true }).click();
    await expect(adminPage.getByLabel('Search by name')).toHaveValue('');
    await expect(adminPage.getByLabel('Role', { exact: true })).toHaveValue('');
    await admin.close();
  }
});
