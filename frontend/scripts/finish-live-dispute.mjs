// Resume the already-created demo dispute; never creates or reopens a booking.
import { readFile, writeFile } from 'node:fs/promises';
import { chromium, expect as baseExpect } from '@playwright/test';
const expect = baseExpect.configure({ timeout: 20000 });
const folder = new URL('../../backend/.local-integration/', import.meta.url), resultFile = new URL('live-results.json', folder);
const accounts = JSON.parse(await readFile(new URL('manual-pass-accounts.json', folder), 'utf8'));
const evidence = JSON.parse(await readFile(resultFile, 'utf8'));
const main = evidence.findLast(row => row.bookingId && row.scheduledStart);
const directBookingId = evidence.findLast(row => row.stage === 'Direct-hire reservation created through professional acceptance')?.directBookingId;
const browser = await chromium.launch({ channel: 'chrome' });
let result;
try {
  const context = await browser.newContext(), page = await context.newPage();
  await page.goto('http://localhost:5173/login');
  await page.getByLabel('Email address').fill(accounts.admin.email);
  await page.getByLabel('Password', { exact: true }).fill(accounts.admin.password);
  const pending = page.waitForResponse(r => r.url().endsWith('/auth/login') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  const login = await pending;
  if (!login.ok()) throw Error('Admin sign-in rejected: ' + login.status());
  const { accessToken, user } = (await login.json()).data;
  await expect(page).toHaveURL(/\/admin$/);
  async function api(path) {
    const response = await fetch('http://localhost:5000/api' + path, { headers: { Authorization: 'Bearer ' + accessToken } });
    const body = await response.json();
    if (!response.ok) throw Error('Read rejected: ' + response.status() + ' ' + body.error?.code);
    return body.data;
  }
  let dispute;
  for (let pageNumber = 1; pageNumber <= 100; pageNumber++) {
    const data = await api('/admin/disputes?page=' + pageNumber + '&limit=50');
    dispute = data.items.find(item => item.booking === directBookingId);
    if (dispute || data.items.length < 50) break;
  }
  if (!dispute) throw Error('Recorded demo dispute not found');
  await page.evaluate(path => { history.pushState({}, '', path); dispatchEvent(new PopStateEvent('popstate')); }, '/admin/disputes/' + dispute.id);
  if (dispute.status === 'OPEN') {
    await expect(page.getByAltText('Private dispute evidence')).toBeVisible();
    await page.getByRole('button', { name: 'Refund customer', exact: true }).click();
    await page.getByRole('dialog').getByLabel('Decision reason').fill('LOCAL DEMO: reviewed synthetic evidence and approved this simulated refund; no real service or money.');
    const decision = page.waitForResponse(r => r.url().endsWith('/admin/disputes/' + dispute.id + '/resolve') && r.request().method() === 'POST');
    await page.getByRole('dialog').getByRole('button', { name: 'Refund customer', exact: true }).click();
    const response = await decision;
    if (!response.ok()) throw Error('Dispute decision rejected: ' + response.status() + ' ' + (await response.json()).error?.code);
  }
  const stored = await api('/admin/disputes/' + dispute.id);
  await expect(page.getByText('Resolved', { exact: true }).first()).toBeVisible();
  const booking = await api('/admin/bookings/' + directBookingId);
  const payment = await api('/admin/payments/' + booking.booking.payment);
  if (stored.dispute.status !== 'RESOLVED' || stored.dispute.adminDecision !== 'REFUND_CUSTOMER' || payment.payment.status !== 'REFUNDED') throw Error('Persisted settlement state differs from expected refund');
  const file = new URL('live-context.json', folder);
  await writeFile(file, JSON.stringify({ jobId: main.jobId, quoteId: main.quoteId, bookingId: main.bookingId, directBookingId, disputeId: dispute.id, adminId: user.id }, null, 2));
  result = { stage: 'Existing direct-hire dispute resolved and persisted mock refund verified', directBookingId, disputeId: dispute.id, at: new Date().toISOString() };
} catch (error) {
  result = { stage: 'Existing dispute verification incomplete', errorType: error.name, summary: /^(Admin sign-in|Read rejected|Dispute decision|Recorded demo|Persisted settlement)/.test(error.message) ? error.message : 'Browser verification did not finish', location: error.stack?.match(/finish-live-dispute\.mjs:\d+:\d+/)?.[0], at: new Date().toISOString() };
  process.exitCode = 1;
} finally {
  await browser.close(); evidence.push(result); await writeFile(resultFile, JSON.stringify(evidence, null, 2)); console.log(JSON.stringify(result));
}
