import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../../backend/package.json', import.meta.url));
const sharp = require('sharp');
const api = 'http://127.0.0.1:5001/api';
async function login(page, email) {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('Test-password123');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}
async function go(page, path) {
  await page.evaluate(path => { history.pushState({}, '', path); dispatchEvent(new PopStateEvent('popstate')); }, path);
}
async function command(page, name) {
  await page.getByRole('button', { name, exact: true }).first().click();
  await page.getByRole('dialog').getByRole('button', { name, exact: true }).click();
}

for (const [index, type] of ['QUOTE_REQUIRED', 'STARTING_FROM', 'HOURLY'].entries()) {
  test(type + ': private request → formal revised quote → exact booking/payment', async ({ browser, request }) => {
    test.setTimeout(180000);
    const auth = await request.post(api + '/auth/login', { data: { email: 'professional@example.test', password: 'Test-password123' } });
    const worker = (await auth.json()).data;
    const headers = { Authorization: 'Bearer ' + worker.accessToken };
    const profile = (await (await request.get(api + '/workers/' + worker.user.id)).json()).data.worker;
    const service = profile.services.find(s => s.name === 'Electrician');
    expect((await request.patch(api + '/workers/me/profile', { headers, data: {
      pricing: [{ service: service.id, type, ...(type === 'QUOTE_REQUIRED' ? {} : { amountBututs: 50000 }) }],
    } })).ok()).toBeTruthy();
    const customerContext = await browser.newContext(), workerContext = await browser.newContext();
    const c = await customerContext.newPage(), w = await workerContext.newPage();
    await login(c, 'customer@example.test');
    await go(c, '/app/proposals/new?worker=' + worker.user.id);
    await c.getByLabel('Service', { exact: true }).selectOption(service.id);
    await expect(c.getByRole('radio', { name: /Use listed price/ })).toHaveCount(0);
    await expect(c.getByLabel('Proposed amount · GMD')).toHaveCount(0);
    if (type === 'STARTING_FROM') await expect(c.getByText('Final price depends on the scope of work.')).toBeVisible();
    if (type === 'HOURLY') await expect(c.getByText(/Hours are not automatically tracked/)).toBeVisible();
    await c.getByLabel('What needs doing?').fill('My ceiling started leaking after rain and the ceiling board needs repair.');
    await c.getByLabel('Town / service area', { exact: true }).fill('Brikama');
    const date = new Date(Date.now() + (12 + index) * 86400000).toISOString().slice(0, 10);
    await c.getByLabel('Preferred start').fill(date + 'T10:00');
    await c.getByLabel('Expected finish').fill(date + 'T11:00');
    if (index === 1) {
      await c.getByRole('checkbox', { name: 'I have a budget (optional)' }).check();
      await c.getByLabel('Minimum · GMD').fill('500');
      await c.getByLabel('Maximum · GMD').fill('1000');
    }
    const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#eda244' } }).png().toBuffer();
    await c.getByLabel('Add photos (optional)').setInputFiles({ name: 'ceiling.png', mimeType: 'image/png', buffer: png });
    await expect(c.getByText('ceiling.png', { exact: true })).toBeVisible();
    const created = c.waitForResponse(r => r.url().endsWith('/api/direct-proposals') && r.request().method() === 'POST');
    await c.getByRole('button', { name: 'Send service proposal', exact: true }).click();
    const p = (await (await created).json()).data.proposal;
    expect(p.agreedAmountBututs).toBeUndefined();
    const card = c.locator('.panel').filter({ hasText: p.description }).first();
    await expect(card.getByText('Quote requested', { exact: true })).toBeVisible();
    await login(w, 'professional@example.test');
    await go(w, '/work/proposals');
    const workerCard = w.locator('.panel').filter({ hasText: p.description }).first();
    await expect(workerCard.getByRole('img', { name: 'Job photo' })).toBeVisible();
    await expect(workerCard.getByRole('img', { name: 'Job photo' })).toHaveJSProperty('naturalWidth', 8);
    await workerCard.getByRole('button', { name: 'Send quote', exact: true }).click();
    await w.getByLabel('Quote amount · GMD').fill('1200');
    await w.getByLabel('What is included? (optional)').fill('Includes labour and replacement ceiling board.');
    await w.getByRole('dialog').getByRole('button', { name: 'Send quote', exact: true }).click();
    await expect(w.getByRole('dialog')).toHaveCount(0);
    await workerCard.getByRole('button', { name: 'Revise quote', exact: true }).click();
    await w.getByLabel('Quote amount · GMD').fill(index === 1 ? '850' : '1000');
    await w.getByRole('dialog').getByRole('button', { name: 'Revise quote', exact: true }).click();
    await expect(w.getByRole('dialog')).toHaveCount(0);
    // Re-enter through the UI with a fresh session to verify persisted current terms.
    await login(c, 'customer@example.test');
    await go(c, '/app/proposals');
    await expect(card.getByText('Professional quote', { exact: true })).toBeVisible();
    await card.getByRole('button', { name: 'Accept quote', exact: true }).click();
    await c.getByRole('dialog').getByRole('button', { name: 'Accept quote', exact: true }).click();
    await expect(c).toHaveURL(/\/app\/bookings\/[a-f0-9]{24}$/);
    const id = c.url().split('/').at(-1);
    await go(c, '/app/bookings/' + id + '/payment');
    await expect(c.getByText(index === 1 ? 'GMD 850.00' : 'GMD 1,000.00').first()).toBeVisible();
    await c.getByRole('button', { name: 'Run payment simulation', exact: true }).click();
    await expect(c.getByText('Held · simulated', { exact: true })).toBeVisible();
    if (index === 0) {
      await request.post('http://127.0.0.1:5001/_test/start-now/' + id, { headers: { 'x-test-fixture': 'local-e2e-only' } });
      await go(w, '/work/bookings/' + id);
      await command(w, 'Start work');
      await w.getByLabel('Completion notes').fill('Repair completed and tested.');
      await w.getByRole('button', { name: 'Mark work complete', exact: true }).click();
      await go(c, '/app/bookings/' + id);
      await command(c, 'Confirm completion');
      await c.getByRole('button', { name: 'Share a review', exact: true }).click();
      await c.getByLabel('Your experience').fill('The formal quote made the price clear.');
      await c.getByRole('dialog').getByRole('button', { name: 'Share a review', exact: true }).click();
      await expect(c.getByText('Released', { exact: true })).toBeVisible();
    }
    await customerContext.close(); await workerContext.close();
    await request.patch(api + '/workers/me/profile', { headers, data: { pricing: profile.pricing.map(p => ({ service: typeof p.service === 'string' ? p.service : p.service.id, type: p.type, ...(p.amountBututs === undefined ? {} : { amountBututs: p.amountBututs }) })) } });
  });
}
