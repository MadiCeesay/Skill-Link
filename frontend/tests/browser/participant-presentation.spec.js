import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../../backend/package.json', import.meta.url));
const sharp = require('sharp');
const api = 'http://127.0.0.1:5001/api';
async function loginApi(request, email) {
  const response = await request.post(api + '/auth/login', { data: { email, password: 'Test-password123' } });
  expect(response.ok()).toBeTruthy();
  return (await response.json()).data;
}
async function login(page, email) {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('Test-password123');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}
test('participants recognize their work and people on desktop and mobile without contact disclosure', async ({ browser, request }) => {
  test.setTimeout(360000);
  const customer = await loginApi(request, 'customer@example.test'), worker = await loginApi(request, 'professional@example.test');
  const customerHeaders = { Authorization: 'Bearer ' + customer.accessToken }, workerHeaders = { Authorization: 'Bearer ' + worker.accessToken };
  const profile = (await (await request.get(api + '/workers/' + worker.user.id)).json()).data.worker;
  const service = profile.services.find(s => s.name === 'Electrician');
  const image = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#b65c18' } }).png().toBuffer();
  const uploaded = await request.post(api + '/media/PROFILE_IMAGE', { headers: workerHeaders, multipart: { file: { name: 'profile.png', mimeType: 'image/png', buffer: image } } });
  expect(uploaded.ok()).toBeTruthy();
  const photo = (await uploaded.json()).data.media;
  expect((await request.patch(api + '/workers/me/profile', { headers: workerHeaders, data: { profileImage: photo.id } })).ok()).toBeTruthy();
  const day = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const proposalResponse = await request.post(api + '/direct-proposals', { headers: customerHeaders, data: {
    worker: worker.user.id, service: service.id, description: 'Inspect and repair the electrical ceiling fixture.', serviceArea: { name: 'Brikama', country: 'GM' },
    agreedAmountBututs: 49979, scheduledStart: day + 'T10:00:00Z', scheduledEnd: day + 'T11:00:00Z',
  } });
  expect(proposalResponse.ok()).toBeTruthy();
  const proposal = (await proposalResponse.json()).data.proposal;
  const accepted = await request.post(api + '/direct-proposals/' + proposal.id + '/accept', { headers: workerHeaders, data: {} });
  expect(accepted.ok()).toBeTruthy();
  const bookingId = (await accepted.json()).data.proposal.booking;
  expect((await request.post(api + '/payments/bookings/' + bookingId + '/checkout', { headers: customerHeaders, data: { idempotencyKey: 'presentation-checkout', outcome: 'SUCCESS' } })).ok()).toBeTruthy();
  const opened = await request.post(api + '/conversations', { headers: customerHeaders, data: { contextType: 'BOOKING', contextId: bookingId } });
  expect(opened.ok()).toBeTruthy();
  const conversationId = (await opened.json()).data.conversation.id;
  expect((await request.post(api + '/conversations/' + conversationId + '/messages', { headers: customerHeaders, data: { type: 'TEXT', text: 'Please bring your electrical testing tools.', clientMessageId: 'presentation-message' } })).ok()).toBeTruthy();
  for (const [role, email, name, base] of [
    ['customer', 'customer@example.test', 'Lamin Jallow', '/app'], ['worker', 'professional@example.test', 'Awa Sowe', '/work'],
  ]) {
    const context = await browser.newContext(), page = await context.newPage();
    await login(page, email);
    for (const width of [1440, 375]) {
      await page.setViewportSize({ width, height: 950 });
      await page.goto(base);
      await expect(page.getByRole('heading', { name: role === 'customer' ? 'Hello, Awa.' : 'Hello, Lamin.', exact: true })).toHaveCount(1);
      await expect(page.getByText(/Good to see you/)).toHaveCount(0);
      await expect(page.locator('a[href="' + base + (role === 'worker' ? '/opportunities' : '/jobs') + '"]').first()).toHaveText('Requests');
      if (role === 'customer') {
        const next = page.getByRole('heading', { name: 'Next booking', exact: true }).locator('..').locator('..').locator('..');
        await expect(next).toContainText('Electrician');
        await expect(next).toContainText('Confirmed');
        await expect(next.getByRole('link', { name: 'View booking', exact: true })).toHaveAttribute('href', base + '/bookings/' + bookingId);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `test-results/plain-${role}-dashboard-${width}.png`, fullPage: true });
      await page.goto(base + '/bookings');
      const row = page.locator('.booking-row').filter({ hasText: name });
      await expect(row).toContainText('Electrician');
      await expect(row).toContainText('Confirmed');
      await expect(row.locator('.chip')).toBeVisible();
      await expect(row).toContainText('GMD 499.79');
      if (role === 'customer') await expect.poll(() => row.locator('img').evaluate(i => i.naturalWidth)).toBeGreaterThan(0);
      await expect(page.locator('body')).not.toContainText(customer.user.phoneNumber);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `test-results/people-${role}-bookings-${width}.png`, fullPage: true });
      await page.goto(base + '/bookings/' + bookingId);
      await expect(page.locator('.booking-person')).toContainText(name);
      await expect(page.locator('.booking-person')).toContainText('Electrician');
      await expect(page.getByText('Booking arranged').locator('..')).not.toContainText('Not reached yet');
      await expect(page.locator('.payment-demo-label')).toHaveCount(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `test-results/people-${role}-detail-${width}.png`, fullPage: true });
      await page.goto(base + '/bookings/' + bookingId + '/payment');
      await expect(page.locator('.payment-demo-label')).toHaveCount(1);
      await expect(page.getByRole('heading', { name: 'Payment', exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `test-results/plain-${role}-payment-${width}.png`, fullPage: true });
      await page.goto(base + '/messages');
      const chat = page.locator('.conversation-row').filter({ hasText: name });
      await expect(chat).toContainText('Electrician');
      await expect(chat).toContainText('Confirmed');
      await expect(chat.locator('.chip')).toBeVisible();
      await page.screenshot({ path: `test-results/people-${role}-messages-${width}.png`, fullPage: true });
      await page.goto(base + '/notifications');
      await expect(page.locator('.notification-row').filter({ hasText: name }).first()).toContainText('Electrician');
      await expect(page.locator('.notification-row').first()).not.toContainText('Booking Worker Marked Completed');
      await expect(page.getByText('Unread', { exact: true }).first()).toBeVisible();
      await page.screenshot({ path: `test-results/people-${role}-notifications-${width}.png`, fullPage: true });
    }
    await page.getByRole('button', { name: 'Mark all read', exact: true }).click();
    await expect(page.getByText('Unread', { exact: true })).toHaveCount(0);
    await context.close();
  }
  const context = await browser.newContext(), page = await context.newPage();
  for (const path of ['/register/customer', '/login', '/forgot-password']) {
    await page.goto(path);
    await expect(page.getByRole('main')).not.toContainText(/not available|not connected|V1 demonstration|tokens out of browser storage/i);
  }
  await login(page, 'customer@example.test');
  await page.goto('/app/profile');
  await expect(page.getByRole('heading', { name: 'My account', exact: true })).toBeVisible();
  await expect(page.getByRole('main')).not.toContainText(/not available|not connected|OTP/);
  await context.close();
  const adminContext = await browser.newContext(), adminPage = await adminContext.newPage();
  await login(adminPage, 'ops@example.test');
  for (const width of [1440, 375]) {
    await adminPage.setViewportSize({ width, height: 950 });
    for (const path of ['/admin/jobs', '/admin/audit', '/admin/payments', '/admin/ledger']) {
      await adminPage.goto(path);
      await expect(adminPage.getByRole('main')).not.toContainText(/endpoint|JobRequest|API|not available|fabricat|transaction/);
      if (/payments|ledger/.test(path)) await expect(adminPage.locator('.payment-demo-label')).toHaveCount(1);
      expect(await adminPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await adminPage.goto('/admin/jobs');
    await expect(adminPage.getByText('Requests with an accepted offer')).toBeVisible();
    await adminPage.screenshot({ path: `test-results/plain-admin-requests-${width}.png`, fullPage: true });
  }
  await adminContext.close();
});
