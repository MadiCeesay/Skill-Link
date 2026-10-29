// Opt-in live development demo. Uses real UI/API, Atlas and configured media provider.
// No test clock, fabricated business records, browser traces, or token persistence.
import { readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { chromium, expect as baseExpect } from '@playwright/test';
const expect = baseExpect.configure({ timeout: 20000 });
import { fileURLToPath } from 'node:url';
import { liveJourney } from './live-journey.mjs';
const folder = new URL('../../backend/.local-integration/', import.meta.url);
let accounts = JSON.parse(await readFile(new URL('accounts.json', folder), 'utf8'));
if (process.argv.includes('--manual-pass')) {
  const accountFile = new URL('manual-pass-accounts.json', folder);
  try { accounts = JSON.parse(await readFile(accountFile, 'utf8')); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const suffix = Date.now().toString(36);
    const create = role => ({ email: `manual-${role}-${suffix}@example.test`, password: 'Demo1-' + randomBytes(20).toString('base64url'), phoneNumber: '+220' + String(Math.floor(Math.random() * 10000000)).padStart(7, '0') });
    accounts = { admin: accounts.admin, customer: create('customer'), worker: create('worker') };
    await writeFile(accountFile, JSON.stringify(accounts, null, 2), { flag: 'wx', mode: 0o600 });
  }
}
const origin = 'http://localhost:5173', apiURL = 'http://localhost:5000/api';
const image = fileURLToPath(new URL('../public/images/professional-at-work.jpg', import.meta.url));
const resultFile = new URL('live-results.json', folder);
let previousEvidence = [];
try { previousEvidence = JSON.parse(await readFile(resultFile, 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const evidence = [...previousEvidence];
const resume = process.argv.includes('--continue')
  ? previousEvidence.findLast(item => item.bookingId && item.scheduledStart)
  : null;
if (process.argv.includes('--continue') && !resume)
  throw Error('No recorded scheduled booking to resume. Run without --continue to create a new demo agreement.');
async function record(stage, details = {}) {
  evidence.push({ stage, ...details, at: new Date().toISOString() });
  console.log(stage);
  await writeFile(resultFile, JSON.stringify(evidence, null, 2));
}
async function api(path, account, body, method = body ? 'POST' : 'GET') {
  const response = await fetch(apiURL + path, { method, headers: { ...(account?.accessToken ? { Authorization: 'Bearer ' + account.accessToken } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const result = await response.json();
  if (!response.ok) throw Error(`${method} ${path}: ${response.status} ${result.error?.code || 'API_ERROR'}`);
  return result.data;
}
const loginAPI = (kind) => api('/auth/login', null, { email: accounts[kind].email, password: accounts[kind].password });
async function navigate(page, path) {
  await page.evaluate((path) => { history.pushState({}, '', path); window.dispatchEvent(new PopStateEvent('popstate')); }, path);
}
async function login(page, kind) {
  await page.goto(origin + '/login');
  await page.getByLabel('Email address').fill(accounts[kind].email);
  await page.getByLabel('Password', { exact: true }).fill(accounts[kind].password);
  const response = page.waitForResponse(r => r.url().endsWith('/auth/login') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  const result = await response;
  const body = await result.json().catch(() => ({}));
  if (!result.ok()) {
    throw Error('Demo sign-in failed: ' + result.status() + ' ' + (body.error?.code || 'REQUEST_FAILED') + (result.status() === 429 ? ' retry after ' + result.headers()['retry-after'] + ' seconds' : ''));
  }
  await expect(page).not.toHaveURL(/\/login$/, { timeout: 20000 });
  return body.data;
}
async function register(page, kind) {
  try { await loginAPI(kind); return login(page, kind); }
  catch (error) { if (!error.message.includes('401')) throw error; }
  await page.goto(origin + '/register/' + kind);
  await page.getByLabel('First name').fill('Integration');
  await page.getByLabel('Last name').fill(kind === 'worker' ? 'Professional' : 'Customer');
  await page.getByLabel('Email address').fill(accounts[kind].email);
  await page.getByLabel('Phone number').fill(accounts[kind].phoneNumber);
  await page.getByLabel('Password', { exact: true }).fill(accounts[kind].password);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page).toHaveURL(kind === 'worker' ? /\/work\// : /\/app$/, { timeout: 20000 });
}
async function confirm(page, label) {
  await page.getByRole('button', { name: label, exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: label, exact: true }).click();
}
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
try {
  const cc = await browser.newContext({ permissions: ['microphone', 'geolocation'], geolocation: { longitude: -16.65, latitude: 13.28 } }), wc = await browser.newContext({ permissions: ['microphone'] }), ac = await browser.newContext();
  const c = await cc.newPage(), w = await wc.newPage(), a = await ac.newPage();
  for (const page of [c, w, a]) page.setDefaultTimeout(25000);
  if (resume) {
    const customer = await login(c, 'customer'), worker = await login(w, 'worker'), admin = await login(a, 'admin');
    const service = (await api('/services')).services.find(item => item.name === 'Electrician');
    const context = await liveJourney({ c, w, a, api, customer, worker, admin, service, image, navigate, confirm, record, resume });
    await navigate(w, '/work/bookings/' + context.bookingId);
    await w.getByRole('button', { name: 'Message', exact: true }).click();
    await expect(w).toHaveURL(/\/messages\//);
    const conversationPath = new URL(w.url()).pathname;
    await w.reload();
    await expect(w).toHaveURL(/\/login$/);
    await login(w, 'worker');
    await navigate(w, conversationPath);
    const audio = w.locator('.message-history audio').last();
    await expect(audio).toBeVisible();
    await expect.poll(() => audio.evaluate(element => element.readyState)).toBeGreaterThanOrEqual(2);
    await audio.evaluate(async element => { element.muted = true; await element.play(); });
    await expect.poll(() => audio.evaluate(element => element.currentTime)).toBeGreaterThan(0);
    await audio.evaluate(element => element.pause());
    await record('Reload sign-in, persisted history and real Cloudinary recipient voice playback passed');
    await writeFile(new URL('live-context.json', folder), JSON.stringify(context, null, 2));
  } else {
  await login(a, 'admin');
  await navigate(a, '/admin/catalog');
  let categories = (await api('/categories')).categories;
  let category = categories.find(item => item.name === 'Home & Utility');
  if (!category) {
    await a.getByRole('button', { name: 'Add category', exact: true }).click();
    await a.getByRole('dialog').getByLabel('Name', { exact: true }).fill('Home & Utility');
    await a.getByRole('dialog').getByLabel('Description', { exact: true }).fill('Home repairs, installations and maintenance.');
    await a.getByRole('dialog').getByRole('button', { name: 'Add category', exact: true }).click();
    await expect(a.getByText('Home & Utility', { exact: true })).toBeVisible();
    category = (await api('/categories')).categories.find(item => item.name === 'Home & Utility');
  }
  let service = (await api('/services')).services.find(item => item.name === 'Electrician');
  if (!service) {
    await a.getByRole('button', { name: 'Services', exact: true }).click();
    await a.getByRole('button', { name: 'Add service', exact: true }).click();
    await a.getByRole('dialog').getByLabel('Name', { exact: true }).fill('Electrician');
    await a.getByRole('dialog').getByLabel('Description', { exact: true }).fill('Electrical inspection, repair and installation.');
    await a.getByRole('dialog').getByLabel('Category', { exact: true }).selectOption(category.id);
    await a.getByRole('dialog').getByRole('button', { name: 'Add service', exact: true }).click();
    await expect(a.getByText('Electrician', { exact: true })).toBeVisible();
    service = (await api('/services')).services.find(item => item.name === 'Electrician');
  }
  await record('Administrator login and database-backed catalog management passed');
  await register(c, 'customer');
  await record('Customer registration/login passed');
  await register(w, 'worker');
  await record('Worker registration/login passed');
  const worker = await loginAPI('worker'), customer = await loginAPI('customer');
  await navigate(w, '/work/profile');
  await w.getByLabel('Professional headline').fill('Integration demo electrician');
  await w.getByLabel('About your work').fill('Dedicated local integration demonstration profile for electrical inspection and repairs in Brikama.');
  await w.getByLabel('Years of experience').fill('4');
  await w.screenshot({ path: fileURLToPath(new URL('onboarding-debug.png', folder)), fullPage: true });
  await w.getByLabel('Electrician', { exact: true }).check();
  await w.getByLabel('Service area 1').fill('Brikama');
  for (const [index, area] of ['Farato', 'Yundum', 'Faraba'].entries()) {
    if (!await w.getByLabel('Service area ' + (index + 2), { exact: true }).count()) await w.getByRole('button', { name: 'Add service area', exact: true }).click();
    await w.getByLabel('Service area ' + (index + 2), { exact: true }).fill(area);
  }
  await w.getByLabel('Profile visibility').selectOption('PUBLIC');
  const saved = w.waitForResponse(response => response.url().endsWith('/api/workers/me/profile') && ['POST', 'PATCH'].includes(response.request().method()));
  await w.getByRole('button', { name: /^(Create|Save) professional profile$/ }).click();
  const savedResponse = await saved;
  if (!savedResponse.ok()) {
    const failure = await savedResponse.json();
    throw Error('Worker profile save: ' + savedResponse.status() + ' ' + failure.error?.code);
  }
  await expect(w.getByText('Your professional profile is saved.')).toBeVisible();
  const profile = (await api('/workers/me/profile', worker)).profile;
  if (!profile.pricing.some(rate => rate.service === service.id && rate.type === 'QUOTE_REQUIRED')) throw Error('Default quote-required pricing was not persisted');
  await record('Customer/worker registration, onboarding and default pricing passed');
  if (process.argv.includes('--setup-only')) process.exitCode = 0;
  else {
    if (!profile.profileImage) {
      await w.getByLabel('Choose a profile photo', { exact: true }).setInputFiles(image);
      await expect(w.locator('.upload-control .row').first()).toBeVisible();
      const photoSaved = w.waitForResponse(response => response.url().endsWith('/api/workers/me/profile') && response.request().method() === 'PATCH');
      await w.getByRole('button', { name: 'Save professional profile', exact: true }).click();
      if (!(await photoSaved).ok()) throw Error('Profile photo association could not be saved');
      await expect(w.getByText('Your professional profile is saved.')).toBeVisible();
    }
    const publicProfile = (await api('/workers/' + worker.user.id)).worker;
    if (!publicProfile.profileImage?.url) throw Error('Public profile image reference missing');
    const photoResponse = await fetch(publicProfile.profileImage.url);
    if (!photoResponse.ok) throw Error('Public Cloudinary profile photo access failed: ' + photoResponse.status);
    await navigate(c, '/professionals/' + worker.user.id);
    await expect.poll(() => c.locator('.profile-hero .avatar img').evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
    await record('Real Cloudinary profile-image upload, persisted reference and public browser rendering passed');
    await navigate(w, '/work/profile/portfolio');
    if (!profile.portfolio.length) {
      await w.getByLabel('Upload a work photo', { exact: true }).setInputFiles(image);
      await w.getByLabel('Project title').fill('Integration demonstration project');
      await w.getByRole('button', { name: 'Add to portfolio', exact: true }).click();
      await expect(w.getByRole('heading', { name: 'Integration demonstration project' })).toBeVisible();
    }
    await navigate(w, '/work/profile/verification');
    const status = (await api('/verifications/me', worker)).verification?.status;
    if (status !== 'APPROVED' && status !== 'PENDING') {
      await w.getByLabel('Upload identity document', { exact: true }).setInputFiles(image);
      await w.getByLabel('Skill certificates (optional)', { exact: true }).setInputFiles(image);
      await w.getByLabel('Work evidence (optional)', { exact: true }).setInputFiles(image);
      await expect(w.locator('.upload-control .row')).toHaveCount(3);
      await expect(w.locator('.upload-control .row').first()).toBeVisible();
      await w.getByRole('button', { name: 'Submit for review', exact: true }).click();
      await expect(w.getByText('Your application is being reviewed.', { exact: false })).toBeVisible();
    }
    const admin = await loginAPI('admin');
    const pending = (await api('/admin/verifications', admin)).verifications;
    const submission = pending.find(item => item.worker === worker.user.id || item.worker?.id === worker.user.id);
    if (submission) {
      await navigate(a, '/admin/verifications/' + submission.id);
      await a.getByRole('button', { name: 'Open identity document', exact: true }).click();
      const protectedURL = await a.getByRole('link', { name: 'Open identity document', exact: true }).getAttribute('href');
      const access = await fetch(protectedURL);
      if (!access.ok) throw Error('Authorized Cloudinary document access failed: ' + access.status);
      await a.getByRole('button', { name: 'Approve identity', exact: true }).click();
      await a.getByRole('dialog').getByLabel('Private notes (optional)').fill('LOCAL DEMO ONLY: synthetic evidence used to exercise integration; not a real identity or professional licensing claim.');
      if (submission.workEvidence?.length) await a.getByRole('dialog').getByLabel('Work evidence reviewed').selectOption('true');
      await a.getByRole('dialog').getByRole('button', { name: 'Approve identity', exact: true }).click();
      await expect(a.getByText('Approved', { exact: true }).first()).toBeVisible();
    }
    await record('Real Cloudinary portfolio, protected verification upload and administrator review passed');
    const context = await liveJourney({ c, w, a, api, customer, worker, admin, service, image, navigate, confirm, record });
    await writeFile(new URL('live-context.json', folder), JSON.stringify(context, null, 2));
  }
  }
} catch (error) {
  // Playwright assertion errors can include filled controls. Do not log raw browser errors.
  await record('Live demo incomplete', { errorType: error.name, location: error.stack?.match(/live-(?:integration|journey)\.mjs:\d+:\d+/)?.[0], summary: String(error.message).split('\n')[0].replace(/https?:\/\/\S+/g, '[URL]').slice(0, 200) });
  process.exitCode = 1;
} finally { await browser.close(); }
