// Real local API/Cloudinary verification with synthetic microphone input.
// No browser traces, tokens, passwords, signed URLs or voice contents are saved.
import { readFile, writeFile } from 'node:fs/promises';
import { chromium, expect as baseExpect } from '@playwright/test';
const expect = baseExpect.configure({ timeout: 20000 });
const folder = new URL('../../backend/.local-integration/', import.meta.url);
const accounts = JSON.parse(await readFile(new URL('manual-pass-accounts.json', folder), 'utf8'));
const { bookingId } = JSON.parse(await readFile(new URL('live-context.json', folder), 'utf8'));
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
async function login(page, role) {
  await page.goto('http://localhost:5173/login');
  await page.getByLabel('Email address').fill(accounts[role].email);
  await page.getByLabel('Password', { exact: true }).fill(accounts[role].password);
  const pending = page.waitForResponse(r => r.url().endsWith('/auth/login') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  const response = await pending;
  if (!response.ok()) {
    const error = await response.json().catch(() => ({}));
    throw Error('Live voice sign-in rejected: ' + response.status() + ' ' + (error.error?.code || 'REQUEST_FAILED') + (response.status() === 429 ? ' retry after ' + response.headers()['retry-after'] + ' seconds' : ''));
  }
  await expect(page).not.toHaveURL(/\/login$/);
}
async function navigate(page, path) {
  await page.evaluate(path => { history.pushState({}, '', path); dispatchEvent(new PopStateEvent('popstate')); }, path);
}
async function playable(page) {
  const audio = page.locator('.message-history audio').last();
  await expect(audio).toBeVisible();
  await expect.poll(() => audio.evaluate(element => element.readyState)).toBeGreaterThanOrEqual(2);
  await audio.evaluate(async element => { element.muted = true; await element.play(); });
  await expect.poll(() => audio.evaluate(element => element.currentTime)).toBeGreaterThan(0);
  await audio.evaluate(element => element.pause());
}
async function sendVoice(from, to) {
  const before = await to.locator('.message-history audio').count();
  await from.getByRole('button', { name: 'Record a voice note' }).click();
  await expect(from.getByText('Recording 0:02')).toBeVisible();
  await from.getByRole('button', { name: 'Stop & preview' }).click();
  const pending = from.waitForResponse(r => r.url().endsWith('/media/VOICE_NOTE') && r.request().method() === 'POST');
  await from.getByRole('button', { name: 'Send voice note' }).click();
  const response = await pending;
  if (!response.ok()) throw Error('Live voice upload rejected: ' + response.status() + ' ' + (await response.json()).error?.code);
  const media = (await response.json()).data.media;
  await expect(to.locator('.message-history audio')).toHaveCount(before + 1);
  await playable(to);
  return { mimeType: media.mimeType, bytes: media.bytes };
}
let result;
try {
  const cc = await browser.newContext({ permissions: ['microphone'] }), wc = await browser.newContext({ permissions: ['microphone'] });
  const customer = await cc.newPage(), worker = await wc.newPage();
  for (const page of [customer, worker]) page.setDefaultTimeout(25000);
  await login(customer, 'customer'); await login(worker, 'worker');
  await navigate(customer, '/app/bookings/' + bookingId);
  await customer.getByRole('button', { name: 'Message', exact: true }).click();
  await expect(customer).toHaveURL(/\/messages\//);
  const conversationId = new URL(customer.url()).pathname.split('/').at(-1);
  await navigate(worker, '/work/messages/' + conversationId);
  await expect(customer.getByText('Connected', { exact: true })).toBeVisible();
  await expect(worker.getByText('Connected', { exact: true })).toBeVisible();
  await playable(customer); await playable(worker);
  const workerToCustomer = await sendVoice(worker, customer);
  const customerToWorker = await sendVoice(customer, worker);
  await customer.reload(); await worker.reload();
  await login(customer, 'customer'); await login(worker, 'worker');
  await navigate(customer, '/app/messages/' + conversationId); await navigate(worker, '/work/messages/' + conversationId);
  await playable(customer); await playable(worker);
  result = { stage: 'Real Cloudinary voice in both directions and playback after reload/re-login passed', workerToCustomer, customerToWorker, at: new Date().toISOString() };
} catch (error) {
  result = { stage: 'Live two-way voice verification incomplete', errorType: error.name, summary: /^Live voice (sign-in|upload) rejected:/.test(error.message) ? error.message : 'Browser assertion did not finish', location: error.stack?.match(/verify-live-voice\.mjs:\d+:\d+/)?.[0], at: new Date().toISOString() };
  process.exitCode = 1;
} finally {
  await browser.close();
  const file = new URL('live-results.json', folder);
  const evidence = JSON.parse(await readFile(file, 'utf8'));
  evidence.push(result); await writeFile(file, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(result));
}
