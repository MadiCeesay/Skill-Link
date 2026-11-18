import { test, expect } from '@playwright/test';
const api = 'http://127.0.0.1:5001/api';
async function credentials(request, email) {
  const r = await request.post(api + '/auth/login', { data: { email, password: 'Test-password123' } });
  expect(r.ok()).toBe(true); return (await r.json()).data;
}
async function login(page, email) {
  await page.goto('/login'); await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('Test-password123');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}
test('both sides negotiate live in chat, then the agreed price is locked by booking and payment', async ({ browser, request }) => {
  test.setTimeout(240000);
  const customer = await credentials(request, 'customer@example.test'), worker = await credentials(request, 'professional@example.test');
  const ch = { Authorization: 'Bearer ' + customer.accessToken }, wh = { Authorization: 'Bearer ' + worker.accessToken };
  const profile = (await (await request.get(api + '/workers/' + worker.user.id)).json()).data.worker;
  const date = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  const made = await request.post(api + '/direct-proposals', { headers: ch, data: { worker: worker.user.id, service: profile.services[0].id, description: 'Please repair the socket and check the electrical wiring.', serviceArea: { name: 'Brikama', country: 'GM' }, agreedAmountBututs: 50000, scheduledStart: date + 'T10:00:00Z', scheduledEnd: date + 'T11:00:00Z' } });
  expect(made.ok()).toBe(true); const proposal = (await made.json()).data.proposal;
  const opened = await request.post(api + '/conversations', { headers: ch, data: { contextType: 'DIRECT_PROPOSAL', contextId: proposal.id } });
  expect(opened.ok()).toBe(true); const conversation = (await opened.json()).data.conversation;
  const cc = await browser.newContext({ viewport: { width: 1440, height: 950 } }), wc = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const c = await cc.newPage(), w = await wc.newPage();
  await login(c, 'customer@example.test'); await login(w, 'professional@example.test');
  await c.goto('/app/messages/' + conversation.id); await w.goto('/work/messages/' + conversation.id);
  for (const p of [c, w]) await expect(p.getByText('Connected', { exact: true })).toBeVisible();
  const send = async (p, value) => { await p.getByLabel('Price offer · GMD').fill(value); await p.getByRole('button', { name: 'Send price offer', exact: true }).click(); };
  const card = (p, price) => p.locator('.chat-price-card').filter({ hasText: price });
  await send(c, '499.79');
  await expect(card(w, 'GMD 499.79').getByRole('button', { name: 'Accept price' })).toBeVisible({ timeout: 10000 });
  await card(w, 'GMD 499.79').getByRole('button', { name: 'Decline price' }).click();
  await expect(card(c, 'GMD 499.79')).toContainText('Declined', { timeout: 10000 });
  await send(w, '600'); await expect(card(c, 'GMD 600.00')).toBeVisible({ timeout: 10000 });
  await send(c, '550');
  await expect(card(w, 'GMD 600.00')).toContainText('Replaced by a newer offer', { timeout: 10000 });
  await card(w, 'GMD 550.00').getByRole('button', { name: 'Accept price' }).click();
  for (const p of [c, w]) {
    await expect(card(p, 'GMD 550.00')).toContainText('Price agreed', { timeout: 10000 });
    await expect(p.locator('.message-history').getByText(/Price offer accepted: GMD 550.00/)).toBeVisible();
  }
  const agreed = (await (await request.get(api + '/direct-proposals/' + proposal.id, { headers: ch })).json()).data.proposal;
  expect(agreed.agreedAmountBututs).toBe(55000); expect(agreed.booking).toBeUndefined();
  for (const width of [1440, 375]) for (const [role, p] of [['customer', c], ['worker', w]]) {
    await p.setViewportSize({ width, height: 950 });
    await card(p, 'GMD 550.00').scrollIntoViewIfNeeded();
    await expect(p.getByRole('button', { name: 'Send price offer', exact: true })).toBeInViewport();
    await expect(p.locator('.chat-header')).toBeInViewport();
    expect(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await p.screenshot({ path: `test-results/chat-price-${role}-${width}.png`, fullPage: true });
  }
  const accepted = await request.post(api + '/direct-proposals/' + proposal.id + '/accept', { headers: wh, data: {} });
  expect(accepted.ok()).toBe(true); const booking = (await accepted.json()).data.proposal.booking;
  expect((await request.post(api + '/payments/bookings/' + booking + '/checkout', { headers: ch, data: { idempotencyKey: 'chat-price-paid', outcome: 'SUCCESS' } })).ok()).toBe(true);
  for (const p of [c, w]) { await p.reload(); await expect(p.locator('.chat-context')).toContainText('Confirmed'); await expect(p.getByLabel('Price offer · GMD')).toHaveCount(0); await expect(p.getByRole('button', { name: 'Accept price', exact: true })).toHaveCount(0); }
  await cc.close(); await wc.close();
});
