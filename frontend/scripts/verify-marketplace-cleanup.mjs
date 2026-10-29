import { chromium, expect as baseExpect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
const expect = baseExpect.configure({ timeout: 20000 });
const folder = new URL('../../backend/.local-integration/', import.meta.url);
const { admin } = JSON.parse(await readFile(new URL('accounts.json', folder), 'utf8'));
const removed = JSON.parse(await readFile(new URL('demo-worker-removal.json', folder), 'utf8')).removedFromMarketplace;
const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage();
  await page.goto('http://localhost:5173/');
  await expect(page.locator('.category-list a').first()).toBeVisible();
  await expect(page.locator('.category-band [role=alert]')).toHaveCount(0);
  const publicState = await page.evaluate(async () => {
    const response = await fetch('http://localhost:5000/api/workers?limit=50');
    if (!response.ok) return { status: response.status };
    const body = await response.json();
    return { status: response.status, workers: body.data.workers.map(worker => ({ id: worker.workerId, name: [worker.name?.firstName, worker.name?.lastName].filter(Boolean).join(' ') })) };
  });
  if (publicState.status !== 200 || removed.some(item => publicState.workers.some(worker => worker.id === item.id))) throw Error('Public removal verification failed');
  const musaPresent = publicState.workers.some(worker => /musa/i.test(worker.name));
  if (!musaPresent) throw Error('Musa preservation needs inspection');
  await page.goto('http://localhost:5173/services');
  await expect(page.locator('.service-card').first()).toBeVisible();
  const icons = await page.locator('.service-card').evaluateAll(cards => cards.map(card => ({ service: card.querySelector('h3').textContent, kind: card.dataset.serviceKind })));
  await page.goto('http://localhost:5173/login');
  await page.getByLabel('Email address').fill(admin.email); await page.getByLabel('Password', { exact: true }).fill(admin.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  const ledger = page.waitForResponse(response => new URL(response.url()).pathname === '/api/admin/ledger');
  await page.evaluate(() => { history.pushState({}, '', '/admin/ledger'); dispatchEvent(new PopStateEvent('popstate')); });
  const response = await ledger;
  if (!response.ok()) throw Error('Admin ledger verification failed: ' + response.status());
  await expect(page.getByRole('alert')).toHaveCount(0);
  const result = { homepageServicesLoaded: true, adminLedgerLoaded: true, generatedWorkersAbsent: true, musaPreserved: musaPresent, servicePresentation: icons, at: new Date().toISOString() };
  await writeFile(new URL('marketplace-cleanup-check.json', folder), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} catch (error) { console.log(JSON.stringify({ verified: false, summary: /^(Public removal|Musa preservation|Admin ledger)/.test(error.message) ? error.message : 'Browser checks did not finish', location: error.stack?.match(/verify-marketplace-cleanup\.mjs:\d+:\d+/)?.[0] })); process.exitCode = 1; }
finally { await browser.close(); }
