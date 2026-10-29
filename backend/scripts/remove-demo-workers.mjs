// Remove only workers tied to Codex's local demo credential artifacts from the
// marketplace. Use the audited status API; retain financial and booking history.
import { readFile, writeFile } from 'node:fs/promises';
import { loadConfig } from '../src/config/env.js';
import mongoose from 'mongoose';
import { User } from '../src/modules/users/user.model.js';
const config = loadConfig();
if (config.NODE_ENV !== 'development') throw Error('Local demo cleanup requires development mode');
const folder = new URL('../.local-integration/', import.meta.url);
const original = JSON.parse(await readFile(new URL('accounts.json', folder), 'utf8'));
const manual = JSON.parse(await readFile(new URL('manual-pass-accounts.json', folder), 'utf8'));
const emails = [original.worker.email, manual.worker.email];
if (new Set(emails).size !== 2 || emails.some(email => !/^(integration|manual)-worker-[a-z0-9]+@example\.test$/.test(email))) throw Error('Demo identities do not match expected generated accounts; no changes made');
const base = `http://localhost:${config.PORT}/api`;
let token;
async function api(path, body, method = body ? 'POST' : 'GET') {
  const response = await fetch(base + path, { method, headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const result = await response.json();
  if (!response.ok) throw Error('Demo cleanup request rejected: ' + response.status + ' ' + result.error?.code + (response.status === 429 ? ' retry after ' + response.headers.get('retry-after') + ' seconds' : ''));
  return result.data;
}
try {
  token = (await api('/auth/login', { email: original.admin.email, password: original.admin.password })).accessToken;
  // The admin list intentionally omits email. Resolve the two exact generated
  // identities read-only here, then perform every change through the audited API.
  await mongoose.connect(config.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  const users = await User.find({ email: { $in: emails } }).select('_id email firstName lastName role accountStatus').lean();
  users.forEach(user => { user.id = String(user._id); });
  await mongoose.disconnect();
  const targets = emails.map(email => users.find(user => user.email === email));
  if (targets.some(user => !user || user.role !== 'WORKER' || /musa/i.test(user.firstName))) throw Error('Demo worker identity check failed; no changes made');
  console.log(JSON.stringify({ selectedDemoWorkers: targets.map(user => ({ id: user.id, name: user.firstName + ' ' + user.lastName, status: user.accountStatus })), mode: process.argv.includes('--remove') ? 'remove-from-marketplace' : 'inspect-only' }));
  if (process.argv.includes('--remove')) {
    for (const user of targets) {
      if (user.accountStatus !== 'DISABLED') await api('/admin/users/' + user.id + '/status', { status: 'DISABLED', reason: 'User requested removal of Codex-created demo worker from the marketplace. Preserve existing booking, payment, review and audit history.' }, 'PATCH');
      const publicResponse = await fetch(base + '/workers/' + user.id);
      if (publicResponse.status !== 404) throw Error('Demo profile removal could not be verified');
    }
    const result = { removedFromMarketplace: targets.map(user => ({ id: user.id, name: user.firstName + ' ' + user.lastName })), unrelatedUsersUnchanged: true, historicalRecordsPreserved: true, at: new Date().toISOString() };
    await writeFile(new URL('demo-worker-removal.json', folder), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
  }
} catch (error) {
  console.error(/^(Demo cleanup|Demo worker|Demo profile)/.test(error.message) ? error.message : 'Demo cleanup could not complete; no secrets printed.');
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
  if (token) await api('/auth/logout', {}).catch(() => {});
}
